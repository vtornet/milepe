import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Quién está en qué grupo. El índice único es lo que impide que dos toques
// seguidos en "Unirme" cuenten dos veces.
const miembroGrupoSchema = new Schema(
  {
    grupo_id: { type: Schema.Types.ObjectId, ref: 'Grupo', required: true },
    usuario_id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

miembroGrupoSchema.index({ grupo_id: 1, usuario_id: 1 }, { unique: true });
miembroGrupoSchema.index({ usuario_id: 1 });

export default model('MiembroGrupo', miembroGrupoSchema);
