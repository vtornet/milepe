import mongoose from 'mongoose';
import puntoSchema from './schemas/puntoSchema.js';

const { Schema, model } = mongoose;

export const CATEGORIAS_TURISMO = ['playa', 'ruta', 'gastronomia', 'otro'];

const turismoDetalleSchema = new Schema(
  {
    // Relacion 1 a 1 con su Post (tipo: 'turismo'). Lo generico (titulo,
    // contenido, imagenes) vive en Post; aqui solo lo especifico de la
    // recomendacion turistica.
    post_id: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      unique: true,
    },
    categoria: {
      type: String,
      enum: CATEGORIAS_TURISMO,
      required: [true, 'La categoria de turismo es obligatoria'],
    },
    // Opcional, como en EventoDetalle: una playa o una ruta tienen un
    // punto claro, pero una recomendacion gastronomica ("los mejores
    // langostinos de la zona") no siempre lo tiene.
    ubicacion: {
      type: puntoSchema,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

turismoDetalleSchema.index({ categoria: 1 });
// Mapa de turismo ("playas/rutas cerca de mi"), mismo patron que
// NegocioDetalle. Los documentos sin ubicacion simplemente no entran en
// las consultas geoespaciales.
turismoDetalleSchema.index({ ubicacion: '2dsphere' });

export default model('TurismoDetalle', turismoDetalleSchema);
