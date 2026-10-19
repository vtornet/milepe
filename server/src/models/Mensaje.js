import mongoose from 'mongoose';
import Conversacion from './Conversacion.js';

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
mensajeSchema.post('save', async function actualizarVistaPreviaDelHilo() {
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
});

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
