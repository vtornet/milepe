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
// El circuito completo -reportes, acciones del moderador, apelaciones y
// auditoria- esta en Reporte.js, Apelacion.js y RegistroModeracion.js.
export const ESTADOS_MODERACION = ['publicado', 'oculto', 'eliminado'];

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
    // Quien tomo la ULTIMA accion de moderacion sobre este post (ocultar,
    // eliminar, restaurar); null mientras nadie lo haya moderado. Es solo
    // un atajo para pintar "moderado por" sin otra consulta: el historial
    // completo -todas las acciones, con su motivo y su fecha- esta en
    // RegistroModeracion, que es lo que hay que consultar para saber por
    // que algo esta como esta.
    moderador_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null,
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

// Reportar tampoco es ya un metodo de Post, por el mismo motivo que
// reaccionar: los reportes viven en su propia coleccion (Reporte), se
// resuelven, y valen igual para un post que para un comentario.
// Reporte.registrar() es quien aplica el umbral de auto-ocultado.

export default model('Post', postSchema);
