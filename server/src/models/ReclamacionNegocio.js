import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export const ESTADOS_RECLAMACION = ['pendiente', 'aceptada', 'rechazada'];

// "Este negocio es mio": un vecino pide gestionar la ficha de un negocio que
// quiza publico otra persona. La resuelve un admin, porque dar la ficha a
// quien no es el dueño seria peor que no darsela a nadie.
const reclamacionNegocioSchema = new Schema(
  {
    post_id: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    usuario_id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    // Lo que le permite al admin comprobarlo: "soy la titular, el telefono
    // del local es...", "puedo mandar foto del CIF"...
    mensaje: {
      type: String,
      trim: true,
      required: [true, 'Cuenta cómo podemos comprobar que el negocio es tuyo'],
      maxlength: 500,
    },
    estado: { type: String, enum: ESTADOS_RECLAMACION, default: 'pendiente' },
    revisor_id: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
    respuesta: { type: String, trim: true, maxlength: 500, default: null },
    fecha_revision: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// Una reclamacion pendiente por persona y negocio; resuelta, se puede volver
// a pedir (con mas pruebas, por ejemplo).
reclamacionNegocioSchema.index(
  { post_id: 1, usuario_id: 1 },
  { unique: true, partialFilterExpression: { estado: 'pendiente' } },
);
reclamacionNegocioSchema.index({ estado: 1, fecha_creacion: 1 });

export default model('ReclamacionNegocio', reclamacionNegocioSchema);
