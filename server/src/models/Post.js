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

// Cuantas versiones anteriores se guardan de un post editado. Hay tope
// porque el historial vive dentro del documento: sin limite, un post muy
// retocado acabaria pesando mas por sus versiones viejas que por lo que
// pone ahora. Se van las mas antiguas, que son las que menos explican.
export const MAX_EDICIONES_GUARDADAS = 20;

// Dos listas de imagenes son la misma si llevan las mismas URLs en el
// mismo orden: reordenar un carrusel tambien cambia lo que se ve.
const mismasImagenes = (a = [], b = []) => a.length === b.length && a.every((url, i) => url === b[i]);

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
    // --- Edicion por el autor ---
    //
    // Editar no devuelve el post a moderacion previa: sigue publicado y
    // visible. Lo que hace una edicion que cambia las imagenes es entrar
    // en la cola de revision (revision_pendiente), que es un eje distinto
    // de estado_moderacion a proposito. Con un estado nuevo ('pendiente')
    // habria bastado cambiar una foto para que el post desapareciera del
    // muro hasta que alguien lo aprobase, y con un solo moderador eso son
    // horas invisible por retocar una imagen.
    editado: {
      type: Boolean,
      default: false,
    },
    editado_en: {
      type: Date,
      default: null,
    },
    // Versiones ANTERIORES, no la actual: el texto y las imagenes de ahora
    // estan en el propio post. Es lo que permite ver con que se publico
    // algo y en que se ha quedado, que es justo lo que hay que mirar
    // cuando una edicion entra en la cola de revision.
    historial_ediciones: {
      type: [
        new Schema(
          {
            titulo: { type: String, default: '' },
            texto: { type: String, default: '' },
            imagenes: { type: [String], default: [] },
            fecha: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    // "Hay que echarle un ojo a esto", independiente de la visibilidad.
    // Lo pone aplicarEdicion() y lo quita el equipo de moderacion.
    revision_pendiente: {
      type: Boolean,
      default: false,
    },
    // El autor retiró su propia publicación. Igual que en Comentario: ambos
    // borrados acaban en estado_moderacion 'eliminado' para que la
    // visibilidad tenga un solo eje, pero este no es una sanción.
    borrado_por_autor: {
      type: Boolean,
      default: false,
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

// Cola de revision por edicion. Parcial porque los posts en revision son
// siempre un puñado: indexar los demas seria pagar un indice entero por
// filas que esta consulta no mira nunca.
postSchema.index({ editado_en: -1 }, { partialFilterExpression: { revision_pendiente: true } });

// Aplica una edicion del autor: archiva la version anterior, cambia los
// campos y decide si hay que revisarla.
//
// La regla de que solo el cambio de imagenes manda a revision vive aqui y
// no en el controlador porque es una regla sobre el contenido, no sobre la
// peticion; devuelve si cambiaron porque de eso depende la entrada que el
// controlador escribe en el registro de moderacion.
postSchema.methods.aplicarEdicion = function aplicarEdicion({ titulo, contenido, imagenes }) {
  this.historial_ediciones.push({
    titulo: this.titulo,
    texto: this.contenido,
    imagenes: [...this.imagenes],
    // Desde cuando era esa version: la edicion anterior si hubo alguna, y
    // si no, desde que se publico.
    fecha: this.editado_en || this.fecha_creacion,
  });

  if (this.historial_ediciones.length > MAX_EDICIONES_GUARDADAS) {
    this.historial_ediciones = this.historial_ediciones.slice(-MAX_EDICIONES_GUARDADAS);
  }

  const imagenesCambiaron = imagenes !== undefined && !mismasImagenes(this.imagenes, imagenes);

  if (titulo !== undefined) this.titulo = titulo;
  if (contenido !== undefined) this.contenido = contenido;
  if (imagenes !== undefined) this.imagenes = imagenes;

  this.editado = true;
  this.editado_en = new Date();
  // Nunca se desmarca aqui: si ya estaba en la cola, una segunda edicion
  // no la cancela.
  if (imagenesCambiaron) this.revision_pendiente = true;

  return { imagenesCambiaron };
};

export default model('Post', postSchema);
