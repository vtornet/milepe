import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Una suscripcion a avisos push del navegador. No es "un usuario quiere
// avisos": es un NAVEGADOR concreto de un usuario concreto, porque el
// permiso se concede por navegador y por dispositivo. El mismo vecino
// puede tener tres filas aqui (movil, portatil, tablet) y hay que mandar
// el aviso a las tres.
//
// Lo que guarda es exactamente lo que devuelve
// PushManager.subscribe() en el cliente: un endpoint propio del servicio
// de push del navegador y dos claves con las que se cifra el contenido.
// El servidor no puede fabricarlo ni adivinarlo, solo guardarlo.
const suscripcionSchema = new Schema(
  {
    usuario_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    // La URL del servicio de push (Google, Mozilla, Apple...) a la que se
    // le entrega el aviso. Es lo que identifica la suscripcion: es unico
    // porque un navegador no tiene dos.
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },
    claves: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// "Todos los navegadores de este vecino", que es la consulta de cada
// aviso.
suscripcionSchema.index({ usuario_id: 1 });

export default model('Suscripcion', suscripcionSchema);
