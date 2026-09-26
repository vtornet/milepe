import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Que tipo de evento genero la notificacion. Determina como el cliente
// interpreta referencia_id/referencia_tipo y que icono/texto usa.
export const TIPOS_NOTIFICACION = [
  'comentario',
  'reaccion',
  'solicitud_amistad',
  'amistad_aceptada',
  'cambio_estado_queja',
  'moderacion',
];

const notificacionSchema = new Schema(
  {
    // El destinatario. Nunca el que provoco el evento (eso, si hace falta
    // mostrarlo, se resuelve del lado del cliente a partir de la
    // referencia, para no duplicar aqui un actor_id que ya vive en el post/
    // comentario/amistad referenciados).
    usuario_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    tipo: {
      type: String,
      enum: TIPOS_NOTIFICACION,
      required: [true, 'El tipo de notificacion es obligatorio'],
    },
    // Texto ya renderizado ("Juan comento en tu queja") en vez de guardar
    // piezas sueltas para montar la frase en el cliente: mas simple, y
    // server y cliente nunca se desincronizan sobre como se redacta.
    mensaje: {
      type: String,
      required: [true, 'El mensaje es obligatorio'],
      trim: true,
      maxlength: 300,
    },
    // A que ir cuando se pulsa la notificacion. referencia_tipo dice que
    // coleccion consultar con referencia_id (no hay un ref fijo posible:
    // puede apuntar a Post, Comentario o Amistad segun el tipo).
    referencia_id: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    referencia_tipo: {
      type: String,
      enum: ['post', 'comentario', 'amistad', null],
      default: null,
    },
    leida: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// El uso de lejos mas frecuente: "mis notificaciones, mas recientes
// primero" y "cuantas sin leer tengo" (para un contador/badge).
notificacionSchema.index({ usuario_id: 1, fecha_creacion: -1 });
notificacionSchema.index({ usuario_id: 1, leida: 1 });

export default model('Notificacion', notificacionSchema);
