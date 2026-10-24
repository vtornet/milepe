import mongoose from 'mongoose';
import puntoSchema from './schemas/puntoSchema.js';
import { ZONAS_FARMACIA } from './Farmacia.js';

const { Schema, model } = mongoose;

// Animales: perdidos, encontrados, en adopcion y que buscan casa de acogida.
// Seccion propia (no el tablon) porque un animal perdido es urgente y
// necesita lo que un anuncio no: foto obligatoria, especie, donde y cuando
// se perdio o se vio, y un telefono para avisar ya.
export const CATEGORIAS_ANIMAL = ['perdido', 'encontrado', 'adopcion', 'acogida'];
export const ESPECIES_ANIMAL = ['perro', 'gato', 'ave', 'otro'];
export const SEXOS_ANIMAL = ['macho', 'hembra', 'desconocido'];

const animalDetalleSchema = new Schema(
  {
    post_id: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      unique: true,
    },
    categoria: {
      type: String,
      enum: CATEGORIAS_ANIMAL,
      required: [true, 'Indica si el animal está perdido, encontrado, en adopción o busca acogida'],
    },
    especie: {
      type: String,
      enum: ESPECIES_ANIMAL,
      required: [true, 'La especie es obligatoria'],
    },
    nombre: { type: String, trim: true, maxlength: 60, default: null },
    sexo: { type: String, enum: SEXOS_ANIMAL, default: 'desconocido' },
    zona: { type: String, enum: ZONAS_FARMACIA, default: 'lepe' },
    // Donde se perdio o se vio. Opcional: en una adopcion no hace falta.
    ubicacion: { type: puntoSchema, default: null },
    // Cuando se perdio o se encontro (ver el pre('validate')).
    fecha_suceso: { type: Date, default: null },
    // Publico a proposito: con un animal perdido, esperar a que te sigan de
    // vuelta para poder escribirte es perder horas. Lo pone el autor si quiere.
    telefono_contacto: { type: String, trim: true, maxlength: 30, default: null },
    // Ya ha vuelto a casa / ya tiene hogar. Deja de salir sin borrarse.
    resuelto: { type: Boolean, default: false },
    fecha_resolucion: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

animalDetalleSchema.index({ ubicacion: '2dsphere' });
animalDetalleSchema.index({ resuelto: 1, categoria: 1 });

// Perdido o encontrado necesita la fecha (y no puede ser futura): "se perdió
// ayer" y "se perdió hace un mes" son búsquedas distintas.
animalDetalleSchema.pre('validate', function comprobarFecha(next) {
  if (['perdido', 'encontrado'].includes(this.categoria)) {
    if (!this.fecha_suceso) {
      this.invalidate('fecha_suceso', 'Indica cuándo se perdió o se encontró');
    } else if (this.fecha_suceso > new Date(Date.now() + 60 * 60 * 1000)) {
      this.invalidate('fecha_suceso', 'La fecha no puede ser futura');
    }
  }
  next();
});

export default model('AnimalDetalle', animalDetalleSchema);
