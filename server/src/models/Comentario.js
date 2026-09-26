import mongoose from 'mongoose';
import Post, { ESTADOS_MODERACION } from './Post.js';
import { TIPOS_REACCION } from './constantes.js';

const { Schema, model } = mongoose;

const comentarioSchema = new Schema(
  {
    post_id: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    autor_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    texto: {
      type: String,
      required: [true, 'El texto del comentario es obligatorio'],
      trim: true,
      maxlength: 1000,
    },
    // Reutilizado como reseña de un negocio (NegocioDetalle) en vez de crear
    // una coleccion de reseñas aparte: un comentario en un post de tipo
    // 'negocio' puede llevar valoracion, el resto simplemente no la usa. Que
    // solo tenga sentido en negocios lo exige el controlador (que ya sabe
    // de que tipo es el post al crear el comentario), no este esquema.
    valoracion: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    // Mismo post-moderacion que Post: visible al instante, un moderador
    // puede ocultarlo o eliminarlo (borrado logico) despues. A diferencia
    // de Post, un comentario no tiene su propio array de reportes: se
    // reporta el post que lo contiene.
    estado_moderacion: {
      type: String,
      enum: ESTADOS_MODERACION,
      default: 'publicado',
    },
    moderador_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null,
    },
    // Igual que en Post: contador por tipo de reaccion, mantenido por
    // Reaccion.alternar().
    reacciones_resumen: {
      type: new Schema(
        Object.fromEntries(TIPOS_REACCION.map((tipo) => [tipo, { type: Number, default: 0, min: 0 }])),
        { _id: false },
      ),
      default: () => ({}),
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// Listar los comentarios de un post en orden cronologico (el uso mas
// frecuente, con diferencia).
comentarioSchema.index({ post_id: 1, fecha_creacion: 1 });
// Comentarios de un usuario (su perfil).
comentarioSchema.index({ autor_id: 1, fecha_creacion: -1 });

// Comprueba que el post referenciado existe de verdad antes de guardar. Es
// la unica comprobacion de integridad referencial que hace este modelo (no
// repite lo mismo con autor_id porque ese siempre sale de la sesion
// autenticada, no de un dato que llegue del cliente).
comentarioSchema.pre('validate', async function comprobarPostExiste(next) {
  if (!this.isModified('post_id')) return next();

  const existe = await Post.exists({ _id: this.post_id });
  if (!existe) {
    this.invalidate('post_id', 'El post referenciado no existe');
  }

  next();
});

// Guarda si el comentario era visible ('publicado') antes de este save, para
// que el hook post('save') sepa si num_comentarios en Post debe subir,
// bajar o no tocarse. Un documento nuevo nunca "era" visible. Se fija en
// TODAS las ramas, sin excepcion: $locals sobrevive entre saves sucesivos
// del mismo documento en memoria, asi que si esta rama no tocase el valor
// cuando estado_moderacion no cambia, post('save') vería el eraVisible de
// un save anterior en vez de "no ha cambiado nada".
comentarioSchema.pre('save', async function capturarEstadoAnterior(next) {
  if (this.isNew) {
    this.$locals.eraVisible = false;
  } else if (this.isModified('estado_moderacion')) {
    const anterior = await this.constructor.findById(this._id).select('estado_moderacion').lean();
    this.$locals.eraVisible = anterior?.estado_moderacion === 'publicado';
  } else {
    // No cambia el estado en este save: que post('save') calcule delta 0.
    this.$locals.eraVisible = this.estado_moderacion === 'publicado';
  }

  next();
});

// Mantiene al dia Post.num_comentarios (desnormalizado) segun si este save
// hizo que el comentario pasase a ser visible, dejase de serlo, o no
// cambiase su visibilidad.
comentarioSchema.post('save', async function actualizarContadorDelPost() {
  const eraVisible = Boolean(this.$locals.eraVisible);
  const esVisibleAhora = this.estado_moderacion === 'publicado';

  if (eraVisible === esVisibleAhora) return;

  const delta = esVisibleAhora ? 1 : -1;
  await Post.updateOne({ _id: this.post_id }, { $inc: { num_comentarios: delta } });
});

// Cubre el borrado fisico de un comentario (poco habitual: lo normal es
// ocultarlo/eliminarlo por estado_moderacion, que ya se descuenta arriba).
// Solo dispara con documento.deleteOne(); un deleteMany/findOneAndDelete
// por query no pasa por aqui y tendria que ajustar el contador a mano.
comentarioSchema.post('deleteOne', { document: true, query: false }, async function descontarSiEraVisible() {
  if (this.estado_moderacion === 'publicado') {
    await Post.updateOne({ _id: this.post_id }, { $inc: { num_comentarios: -1 } });
  }
});

export default model('Comentario', comentarioSchema);
