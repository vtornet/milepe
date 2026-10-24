import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// "Voy a ir" a un evento. Una fila por persona y evento; el contador visible
// vive desnormalizado en EventoDetalle.asistentes (mismo criterio que
// num_comentarios), y este indice unico es lo que impide contar dos veces a
// alguien que pulsa dos veces.
const asistenciaEventoSchema = new Schema(
  {
    post_id: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    usuario_id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: false },
  },
);

asistenciaEventoSchema.index({ post_id: 1, usuario_id: 1 }, { unique: true });
asistenciaEventoSchema.index({ usuario_id: 1, fecha_creacion: -1 });

export default model('AsistenciaEvento', asistenciaEventoSchema);
