import mongoose from 'mongoose';
import { TIPOS_CONTENIDO_MODERABLE } from './constantes.js';

const { Schema, model } = mongoose;

// Notas internas del equipo sobre un contenido ("ya le avisé por mensaje",
// "es la tercera vez", "consultado con el admin"). Van sobre el CONTENIDO y
// no sobre un reporte concreto, igual que Apelacion: el contexto sirve para
// todos sus reportes y para su apelación.
//
// Nunca salen hacia el autor ni hacia nadie de fuera del equipo (ni en
// mi-contenido-moderado ni en ningún listado público). Son de solo añadir,
// como el registro de moderación: una nota que se puede borrar no sirve de
// contexto.
const PROHIBIDO = 'Las notas de moderación no se modifican ni se borran';

const notaModeracionSchema = new Schema(
  {
    contenido_tipo: { type: String, enum: TIPOS_CONTENIDO_MODERABLE, required: true },
    contenido_id: { type: Schema.Types.ObjectId, required: true },
    autor_id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    texto: {
      type: String,
      required: [true, 'La nota está vacía'],
      trim: true,
      maxlength: [1000, 'La nota es demasiado larga'],
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

notaModeracionSchema.index({ contenido_tipo: 1, contenido_id: 1, fecha_creacion: 1 });

notaModeracionSchema.pre('save', function impedirModificacion(next) {
  if (!this.isNew) {
    next(new Error(PROHIBIDO));
    return;
  }
  next();
});

notaModeracionSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne'],
  function impedirActualizacion(next) {
    next(new Error(PROHIBIDO));
  },
);

notaModeracionSchema.pre(
  ['deleteOne', 'deleteMany', 'findOneAndDelete'],
  { document: true, query: true },
  function impedirBorrado(next) {
    next(new Error(PROHIBIDO));
  },
);

export default model('NotaModeracion', notaModeracionSchema);
