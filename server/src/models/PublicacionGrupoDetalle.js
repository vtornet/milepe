import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Detalle de un Post de tipo 'grupo': en qué grupo se publicó. Mismo patrón
// Post + *_detalle que el resto de secciones.
const publicacionGrupoDetalleSchema = new Schema(
  {
    post_id: { type: Schema.Types.ObjectId, ref: 'Post', required: true, unique: true },
    grupo_id: { type: Schema.Types.ObjectId, ref: 'Grupo', required: true },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// Lo publicado en un grupo, lo más reciente primero.
publicacionGrupoDetalleSchema.index({ grupo_id: 1, fecha_creacion: -1 });

export default model('PublicacionGrupoDetalle', publicacionGrupoDetalleSchema);
