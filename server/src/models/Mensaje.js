import mongoose from 'mongoose';
import Conversacion from './Conversacion.js';
import { ESTADOS_MODERACION } from './Post.js';

const { Schema, model } = mongoose;

const mensajeSchema = new Schema(
  {
    conversacion_id: {
      type: Schema.Types.ObjectId,
      ref: 'Conversacion',
      required: true,
    },
    autor_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    texto: {
      type: String,
      required: [true, 'El mensaje no puede estar vacio'],
      trim: true,
      maxlength: 2000,
    },
    // Fecha en que el otro participante lo leyo, null mientras no lo haya
    // hecho. Se guarda la fecha y no un booleano porque con un booleano no
    // se puede enseñar "visto a las 20:14" y pasar de uno a la otra seria
    // una migracion; al contrario (ignorar la fecha y pintar solo el tick)
    // no cuesta nada.
    leido_en: {
      type: Date,
      default: null,
    },
    // Un mensaje privado se puede reportar, asi que entra en el circuito
    // generico de moderacion, y eso exige los mismos tres campos que ya
    // comparten Post y Comentario: autor_id (ya estaba),
    // estado_moderacion y moderador_id. Sin ellos,
    // utils/contenidoModerable.js no podria tratarlo como trata a los
    // otros dos y la moderacion dejaria de ser generica.
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
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// El uso casi exclusivo: abrir un hilo y pintarlo en orden.
mensajeSchema.index({ conversacion_id: 1, fecha_creacion: 1 });
// Contar no leidos del hilo que no son mios (el parcial evita indexar los
// ya leidos, que son la mayoria y no se consultan nunca por aqui).
mensajeSchema.index(
  { conversacion_id: 1, autor_id: 1 },
  { partialFilterExpression: { leido_en: null } },
);

// Mantiene al dia la vista previa de la conversacion. Mismo criterio que
// num_comentarios / reacciones_resumen: es un contador/resumen
// desnormalizado y la integridad no puede depender de que cada controlador
// se acuerde, asi que va en un hook del modelo (al contrario que las
// notificaciones, que se crean explicitamente desde el controlador).
// updateOne con $set toca fecha_actualizacion a proposito: la lista de
// conversaciones se ordena por ese campo, asi que un mensaje nuevo tiene
// que subir el hilo arriba.
//
// SOLO al crear. Antes no hacia falta distinguirlo, porque un mensaje se
// guardaba una vez y nunca mas (marcarLeidos usa updateMany, que no pasa
// por aqui). Desde que un mensaje se puede moderar ya no es verdad: un
// moderador ocultando un mensaje de hace un mes lo guarda otra vez, y sin
// este guardia la vista previa del hilo pasaria a ser ese mensaje viejo y
// la conversacion subiria al principio de la bandeja como si acabara de
// llegar algo.
mensajeSchema.pre('save', function recordarSiEsNuevo(next) {
  this.$locals.esNuevo = this.isNew;
  this.$locals.cambiaModeracion = !this.isNew && this.isModified('estado_moderacion');
  next();
});

mensajeSchema.post('save', async function actualizarVistaPreviaDelHilo() {
  if (this.$locals.esNuevo) {
    await Conversacion.updateOne(
      { _id: this.conversacion_id },
      {
        $set: {
          ultimo_mensaje: {
            texto: this.texto,
            autor_id: this.autor_id,
            fecha: this.fecha_creacion,
          },
          fecha_actualizacion: new Date(),
        },
      },
    );
    return;
  }

  // Si lo que ha cambiado es la moderacion, hay que rehacer la vista
  // previa: el texto retirado esta copiado en Conversacion, asi que sin
  // esto seguiria leyendose en la bandeja de entrada despues de haberlo
  // ocultado. Ocultar algo que se sigue leyendo en otra pantalla no es
  // ocultarlo.
  if (this.$locals.cambiaModeracion) {
    await this.constructor.refrescarVistaPrevia(this.conversacion_id);
  }
});

// Rehace la vista previa del hilo a partir de su ultimo mensaje.
//
// timestamps: false es imprescindible, no un detalle: Mongoose actualiza
// fecha_actualizacion por su cuenta en CUALQUIER updateOne, y la bandeja
// de entrada se ordena por ese campo. Sin esto, ocultar un mensaje de hace
// un mes subiria la conversacion al principio de la bandeja del otro como
// si acabara de llegar algo. Lo descubrio la prueba de humo, que compara
// la fecha antes y despues.
mensajeSchema.statics.refrescarVistaPrevia = async function refrescarVistaPrevia(conversacionId) {
  const ultimo = await this.findOne({ conversacion_id: conversacionId }).sort({ fecha_creacion: -1 });

  if (!ultimo) return;

  await Conversacion.updateOne(
    { _id: conversacionId },
    {
      $set: {
        ultimo_mensaje: {
          texto: ultimo.estado_moderacion === 'publicado' ? ultimo.texto : 'Mensaje retirado',
          autor_id: ultimo.autor_id,
          fecha: ultimo.fecha_creacion,
        },
      },
    },
    { timestamps: false },
  );
};

// Marca como leidos los mensajes que el otro envio en este hilo. Devuelve
// cuantos ha marcado, que es justo lo que el cliente necesita para bajar el
// contador sin volver a consultar. Deliberadamente no marca los propios:
// "leido" significa que lo leyo el que lo recibio.
mensajeSchema.statics.marcarLeidos = async function marcarLeidos(conversacionId, lectorId) {
  const resultado = await this.updateMany(
    { conversacion_id: conversacionId, autor_id: { $ne: lectorId }, leido_en: null },
    { $set: { leido_en: new Date() } },
  );

  return resultado.modifiedCount;
};

// Cuantos mensajes sin leer tiene un usuario en una conversacion. Se usa
// para la insignia de la lista de hilos.
mensajeSchema.statics.contarNoLeidos = function contarNoLeidos(conversacionId, lectorId) {
  return this.countDocuments({
    conversacion_id: conversacionId,
    autor_id: { $ne: lectorId },
    leido_en: null,
  });
};

export default model('Mensaje', mensajeSchema);
