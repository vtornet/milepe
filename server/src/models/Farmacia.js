import mongoose from 'mongoose';
import puntoSchema from './schemas/puntoSchema.js';

const { Schema, model } = mongoose;

// Las tres zonas del municipio con farmacias. 'otra' para lo que no encaje
// (una farmacia de un pueblo vecino que cubra una guardia).
export const ZONAS_FARMACIA = ['lepe', 'la_antilla', 'islantilla', 'otra'];

// Directorio de farmacias. Standalone, como ContactoInteres: sin Post, sin
// autor, sin moderacion. Lo mantiene un admin. Las guardias (que farmacia
// esta de guardia cada dia) viven aparte, en GuardiaFarmacia.
const farmaciaSchema = new Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre de la farmacia es obligatorio'],
      trim: true,
      maxlength: 100,
    },
    zona: {
      type: String,
      enum: ZONAS_FARMACIA,
      default: 'lepe',
    },
    direccion: { type: String, trim: true, maxlength: 200, default: null },
    telefono: { type: String, trim: true, maxlength: 30, default: null },
    // Opcional: con el punto se ofrece "Cómo llegar" en el mapa.
    ubicacion: { type: puntoSchema, default: null },
    // Texto libre ("L-V 9:30-13:30 y 17:00-20:30"). Es el horario normal;
    // lo de guardia va en la propia guardia.
    horario: { type: String, trim: true, maxlength: 300, default: null },
    // Cerrada o fuera del turno rotatorio sin perder su historial de guardias.
    activa: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

farmaciaSchema.index({ activa: 1, zona: 1, nombre: 1 });

export default model('Farmacia', farmaciaSchema);
