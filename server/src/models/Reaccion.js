import mongoose from 'mongoose';
import Post from './Post.js';
import Comentario from './Comentario.js';
import { TIPOS_REACCION } from './constantes.js';

const { Schema, model } = mongoose;

export { TIPOS_REACCION };

const reaccionSchema = new Schema(
  {
    autor_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    // Reacciona a un post O a un comentario, nunca a los dos. Se comparten
    // coleccion y modelo (en vez de PostReaction/CommentReaction aparte)
    // porque la logica de alternar/contar es identica; solo cambia a que
    // coleccion se le suma el contador.
    post_id: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      default: null,
    },
    comentario_id: {
      type: Schema.Types.ObjectId,
      ref: 'Comentario',
      default: null,
    },
    tipo: {
      type: String,
      enum: TIPOS_REACCION,
      required: [true, 'El tipo de reaccion es obligatorio'],
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

reaccionSchema.pre('validate', function comprobarUnSoloObjetivo(next) {
  const tieneAmbos = Boolean(this.post_id) && Boolean(this.comentario_id);
  const noTieneNinguno = !this.post_id && !this.comentario_id;

  if (tieneAmbos || noTieneNinguno) {
    this.invalidate('post_id', 'Una reaccion es a un post o a un comentario, nunca a los dos ni a ninguno');
  }

  next();
});

// Una reaccion por usuario y objetivo (cambiar de tipo se hace vía
// alternar(), no creando una segunda). Parciales porque solo uno de los dos
// campos objetivo esta relleno en cada documento.
reaccionSchema.index(
  { post_id: 1, autor_id: 1 },
  { unique: true, partialFilterExpression: { post_id: { $type: 'objectId' } } },
);
reaccionSchema.index(
  { comentario_id: 1, autor_id: 1 },
  { unique: true, partialFilterExpression: { comentario_id: { $type: 'objectId' } } },
);

// Da, cambia o quita la reaccion de un usuario sobre un post o un
// comentario (exactamente uno de los dos, no ambos) y mantiene al dia el
// reacciones_resumen desnormalizado del objetivo. Toggle: reaccionar con el
// mismo tipo que ya tenias la quita; con uno distinto, la cambia.
reaccionSchema.statics.alternar = async function alternar({ autor_id, tipo, post_id = null, comentario_id = null }) {
  if (!TIPOS_REACCION.includes(tipo)) {
    throw new Error(`Tipo de reaccion no valido: ${tipo}`);
  }
  if (Boolean(post_id) === Boolean(comentario_id)) {
    throw new Error('Hay que indicar post_id o comentario_id, exactamente uno de los dos');
  }

  const Modelo = post_id ? Post : Comentario;
  const idObjetivo = post_id || comentario_id;
  const filtro = post_id ? { autor_id, post_id } : { autor_id, comentario_id };

  const existente = await this.findOne(filtro);

  if (!existente) {
    await this.create({ autor_id, tipo, post_id, comentario_id });
    await Modelo.updateOne({ _id: idObjetivo }, { $inc: { [`reacciones_resumen.${tipo}`]: 1 } });
    return { accion: 'creada', tipo };
  }

  if (existente.tipo === tipo) {
    await existente.deleteOne();
    await Modelo.updateOne({ _id: idObjetivo }, { $inc: { [`reacciones_resumen.${tipo}`]: -1 } });
    return { accion: 'quitada', tipo: null };
  }

  const tipoAnterior = existente.tipo;
  existente.tipo = tipo;
  await existente.save();
  await Modelo.updateOne(
    { _id: idObjetivo },
    { $inc: { [`reacciones_resumen.${tipoAnterior}`]: -1, [`reacciones_resumen.${tipo}`]: 1 } },
  );
  return { accion: 'cambiada', tipo, tipo_anterior: tipoAnterior };
};

export default model('Reaccion', reaccionSchema);
