import mongoose from 'mongoose';
import { TIPOS_REACCION } from './constantes.js';

const { Schema, model } = mongoose;

// Espina dorsal del feed: el Muro y cada seccion consultan esta coleccion
// filtrando por tipo. El contenido especifico de cada tipo (categoria de
// queja, sector de empleo, fecha de un evento...) vive en su coleccion
// *_detalle, enlazada por post_id, no aqui.
export const TIPOS_POST = [
  'muro',
  'queja',
  'turismo',
  'foto',
  'evento',
  'empleo_busco',
  'empleo_ofrezco',
  'negocio',
];

// Post-moderacion con reportes: se publica al instante y solo se revisa si
// alguien reporta. 'eliminado' es un borrado logico (nunca se borra el
// documento) para conservar el historial y las referencias de comentarios.
export const ESTADOS_MODERACION = ['publicado', 'oculto', 'eliminado'];

// A partir de este numero de reportes distintos, el post se oculta solo en
// espera de revision manual del moderador (no se borra).
const UMBRAL_REPORTES_AUTO_OCULTAR = 3;

const reporteSchema = new Schema(
  {
    usuario_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    motivo: {
      type: String,
      required: [true, 'El motivo del reporte es obligatorio'],
      trim: true,
      maxlength: 300,
    },
    fecha: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const postSchema = new Schema(
  {
    autor_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    tipo: {
      type: String,
      enum: TIPOS_POST,
      required: [true, 'El tipo de publicacion es obligatorio'],
    },
    // Obligatorio o no segun la seccion (p. ej. si en 'queja' o 'evento',
    // opcional en 'foto' o 'muro'); esa validacion especifica se hace en el
    // controlador de cada seccion junto con su *_detalle correspondiente.
    titulo: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    contenido: {
      type: String,
      required: [true, 'El contenido es obligatorio'],
      trim: true,
      maxlength: 5000,
    },
    // URLs de Cloudinary. Un post puede no llevar imagen (p. ej. 'muro'),
    // por eso no es obligatorio a este nivel.
    imagenes: {
      type: [String],
      default: [],
    },
    // Desnormalizado igual que num_comentarios: un contador por tipo de
    // reaccion, para no tener que agregar la coleccion Reaccion en cada
    // renderizado del feed. Lo mantiene al dia Reaccion.alternar().
    reacciones_resumen: {
      type: new Schema(
        Object.fromEntries(TIPOS_REACCION.map((tipo) => [tipo, { type: Number, default: 0, min: 0 }])),
        { _id: false },
      ),
      default: () => ({}),
    },
    // Desnormalizado para no contar la coleccion Comentarios en cada
    // renderizado del feed. Lo mantiene al dia el modelo Comentario
    // (hooks post-save / post-remove) cuando se implemente.
    num_comentarios: {
      type: Number,
      default: 0,
      min: 0,
    },
    estado_moderacion: {
      type: String,
      enum: ESTADOS_MODERACION,
      default: 'publicado',
    },
    // Quien tomo la ultima accion de moderacion sobre este post (ocultar,
    // eliminar, restaurar). null mientras nadie haya moderado el post.
    moderador_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null,
    },
    reportes: {
      type: [reporteSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// Feed general (Muro): todo lo publicado, mas reciente primero.
postSchema.index({ estado_moderacion: 1, fecha_creacion: -1 });
// Feed de una seccion concreta (p. ej. /quejas).
postSchema.index({ tipo: 1, estado_moderacion: 1, fecha_creacion: -1 });
// Publicaciones de un usuario (su perfil).
postSchema.index({ autor_id: 1, fecha_creacion: -1 });
// Busqueda libre por texto en el muro.
postSchema.index({ titulo: 'text', contenido: 'text' });

// Reaccionar (me_gusta/me_encanta/apoyo/triste) ya no es un metodo de Post:
// lo gestiona Reaccion.alternar(), que es quien mantiene reacciones_resumen
// al dia. Vive en su propio modelo porque tambien reacciona a comentarios,
// no solo a posts.

// Registra el reporte de un usuario. Un mismo usuario no puede reportar el
// mismo post dos veces. Si se alcanza el umbral, el post se oculta solo en
// espera de que un moderador lo revise. No persiste el cambio: el
// controlador debe llamar a post.save() despues.
postSchema.methods.reportar = function reportar(usuarioId, motivo) {
  const yaReportado = this.reportes.some((reporte) => reporte.usuario_id.equals(usuarioId));

  if (yaReportado) {
    throw new Error('Este usuario ya ha reportado esta publicacion');
  }

  this.reportes.push({ usuario_id: usuarioId, motivo });

  if (this.estado_moderacion === 'publicado' && this.reportes.length >= UMBRAL_REPORTES_AUTO_OCULTAR) {
    this.estado_moderacion = 'oculto';
  }

  return this;
};

export default model('Post', postSchema);
