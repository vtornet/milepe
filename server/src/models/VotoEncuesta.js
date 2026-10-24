import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// El voto de una persona en una encuesta. Uno por persona (indice unico);
// cambiarlo mientras la encuesta esta abierta mueve el contador. Nunca sale
// en ninguna respuesta de la API salvo, a cada uno, el suyo.
const votoEncuestaSchema = new Schema(
  {
    post_id: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    usuario_id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    opcion: { type: Number, required: true, min: 0 },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

votoEncuestaSchema.index({ post_id: 1, usuario_id: 1 }, { unique: true });
votoEncuestaSchema.index({ usuario_id: 1 });

export default model('VotoEncuesta', votoEncuestaSchema);
