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
    // Comentario al que responde; null es un comentario de primer nivel.
    // El hilo se guarda asi, con un puntero al padre, y no con una ruta
    // tipo "1.4.2": cambiar de sitio un comentario no es una operacion que
    // exista aqui, y una ruta obliga a reescribir la de todos sus
    // descendientes el dia que se necesite.
    padre_id: {
      type: Schema.Types.ObjectId,
      ref: 'Comentario',
      default: null,
    },
    // Niveles por debajo de la raiz. Lo calcula el hook de abajo a partir
    // del padre y NUNCA llega del cliente: con un numero propio,
    // cualquiera podria colocar su respuesta en el nivel que quisiera.
    profundidad: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Desnormalizado, misma razon que num_comentarios en Post: el boton
    // "Ver N respuestas" necesita la N sin contar la coleccion una vez por
    // cada comentario de la pagina.
    //
    // Cuenta TODAS las respuestas que siguen existiendo, incluidas las
    // retiradas, porque el listado tambien las devuelve (como hueco, para
    // no romper el hilo que cuelga de ellas). Si contase solo las visibles,
    // una respuesta borrada cuyo propio hilo sigue vivo dejaria el contador
    // en cero, no se pintaria el boton y ese trozo de conversacion se
    // volveria inalcanzable. Es una regla distinta a la de
    // Post.num_comentarios, que si cuenta solo lo visible porque es el
    // numero que se le ensena a la gente.
    num_respuestas: {
      type: Number,
      default: 0,
      min: 0,
    },
    editado: {
      type: Boolean,
      default: false,
    },
    editado_en: {
      type: Date,
      default: null,
    },
    // Lo retiro su autor, no un moderador. Comparte estado_moderacion
    // ('eliminado') con la moderacion porque la visibilidad tiene que ser
    // un solo eje -dos campos diciendo si algo se ve acaban
    // contradiciendose-, pero hace falta distinguirlos: un comentario que
    // borraste tu no es una sancion, y sin esta marca apareceria en "mi
    // contenido moderado" como si un moderador te hubiera castigado, con
    // su boton de apelar al lado.
    borrado_por_autor: {
      type: Boolean,
      default: false,
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
// Un nivel del hilo: las raices de un post (padre_id null) o las
// respuestas de un comentario. Es el indice del listado desde que los
// comentarios son en cascada, porque ya nunca se piden todos de golpe.
comentarioSchema.index({ post_id: 1, padre_id: 1, fecha_creacion: 1 });
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

// Coloca una respuesta en el hilo: comprueba que el comentario al que
// responde existe y es del mismo post, y calcula su profundidad a partir
// de la del padre.
//
// Vive aqui y no en el controlador por lo mismo que la comprobacion de
// arriba: es integridad del dato. Y de paso hace imposible que profundidad
// venga mal, porque no hay ningun camino para crear un comentario que no
// pase por este hook.
//
// Solo al crear: un comentario no cambia de padre nunca.
comentarioSchema.pre('validate', async function colocarEnElHilo(next) {
  if (!this.isNew) return next();

  if (!this.padre_id) {
    this.profundidad = 0;
    return next();
  }

  const padre = await this.constructor.findById(this.padre_id).select('post_id profundidad').lean();

  if (!padre) {
    this.invalidate('padre_id', 'El comentario al que respondes no existe');
  } else if (String(padre.post_id) !== String(this.post_id)) {
    // Sin esto se podria colgar una respuesta de un comentario de otro
    // post y partir el hilo entre dos publicaciones.
    this.invalidate('padre_id', 'La respuesta y el comentario al que responde no son del mismo post');
  } else {
    this.profundidad = padre.profundidad + 1;
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
    // post('save') ya no puede preguntar por isNew (a esas alturas es
    // false), asi que la respuesta se marca aqui.
    this.$locals.esRespuestaNueva = Boolean(this.padre_id);
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

// Mantiene num_respuestas del padre. Solo al crear: retirar una respuesta
// no la descuenta, porque el listado la sigue devolviendo como hueco y el
// numero del boton tiene que cuadrar con las filas que van a aparecer.
comentarioSchema.post('save', async function sumarRespuestaAlPadre() {
  if (!this.$locals.esRespuestaNueva) return;
  this.$locals.esRespuestaNueva = false;
  await this.constructor.updateOne({ _id: this.padre_id }, { $inc: { num_respuestas: 1 } });
});

// Cubre el borrado fisico de un comentario (poco habitual: lo normal es
// ocultarlo/eliminarlo por estado_moderacion, que ya se descuenta arriba).
// Solo dispara con documento.deleteOne(); un deleteMany/findOneAndDelete
// por query no pasa por aqui y tendria que ajustar el contador a mano.
comentarioSchema.post('deleteOne', { document: true, query: false }, async function descontarSiEraVisible() {
  if (this.estado_moderacion === 'publicado') {
    await Post.updateOne({ _id: this.post_id }, { $inc: { num_comentarios: -1 } });
  }
  // Este si descuenta del padre: aqui la fila desaparece de verdad, asi
  // que el listado ya no la va a devolver.
  if (this.padre_id) {
    await this.constructor.updateOne({ _id: this.padre_id }, { $inc: { num_respuestas: -1 } });
  }
});

export default model('Comentario', comentarioSchema);
