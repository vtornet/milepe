import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Avisos oficiales (cortes de agua o de tráfico, bandos, obras...). Solo
// los publica una cuenta oficial o un admin (ver avisosController). Siguen
// el patron Post + *_detalle: son contenido publicable, con reacciones,
// comentarios y moderacion como cualquier otro.
export const CATEGORIAS_AVISO = ['agua', 'trafico', 'obras', 'bando', 'limpieza', 'emergencia', 'otro'];

const avisoDetalleSchema = new Schema(
  {
    post_id: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      unique: true,
    },
    categoria: {
      type: String,
      enum: CATEGORIAS_AVISO,
      required: [true, 'La categoria del aviso es obligatoria'],
    },
    // "Vale mientras la fecha este en el futuro", como destacado_hasta: un
    // corte de agua de hoy no debe seguir arriba del Muro la semana que
    // viene. Sin fecha, el aviso no caduca.
    vigente_hasta: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

avisoDetalleSchema.methods.estaVigente = function estaVigente(ahora = new Date()) {
  return !this.vigente_hasta || this.vigente_hasta > ahora;
};

export default model('AvisoDetalle', avisoDetalleSchema);
