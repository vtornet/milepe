import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export const MIN_OPCIONES = 2;
export const MAX_OPCIONES = 6;
export const MAX_DIAS_ENCUESTA = 60;

// Encuestas y consultas ciudadanas. La pregunta es el titulo del Post; aqui,
// las opciones y el recuento. `votos[i]` es el contador de `opciones[i]`
// (desnormalizado, como num_comentarios); quien voto que esta en
// VotoEncuesta y no se publica nunca.
const encuestaDetalleSchema = new Schema(
  {
    post_id: { type: Schema.Types.ObjectId, ref: 'Post', required: true, unique: true },
    opciones: {
      type: [{ type: String, trim: true, maxlength: 80 }],
      validate: {
        validator: (lista) =>
          lista.length >= MIN_OPCIONES && lista.length <= MAX_OPCIONES && lista.every((o) => o && o.trim()),
        message: `Una encuesta lleva entre ${MIN_OPCIONES} y ${MAX_OPCIONES} opciones, ninguna vacía`,
      },
    },
    votos: { type: [Number], default: [] },
    total_votos: { type: Number, default: 0, min: 0 },
    // Cuando deja de admitir votos y enseña el resultado a todo el mundo.
    cierra_en: { type: Date, required: [true, 'Indica cuándo se cierra la encuesta'] },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

encuestaDetalleSchema.pre('validate', function comprobar(next) {
  // Opciones repetidas no tienen sentido y partirian el voto.
  const normalizadas = (this.opciones || []).map((o) => o.trim().toLowerCase());
  if (new Set(normalizadas).size !== normalizadas.length) {
    this.invalidate('opciones', 'Hay opciones repetidas');
  }
  if (this.isNew) {
    if (!this.votos?.length) this.votos = this.opciones.map(() => 0);
    const ahora = Date.now();
    if (this.cierra_en && this.cierra_en <= ahora) this.invalidate('cierra_en', 'La fecha de cierre tiene que ser futura');
    if (this.cierra_en && this.cierra_en - ahora > MAX_DIAS_ENCUESTA * 86400000) {
      this.invalidate('cierra_en', `Una encuesta puede durar como mucho ${MAX_DIAS_ENCUESTA} días`);
    }
  }
  next();
});

encuestaDetalleSchema.methods.estaAbierta = function estaAbierta(ahora = new Date()) {
  return this.cierra_en > ahora;
};

export default model('EncuestaDetalle', encuestaDetalleSchema);
