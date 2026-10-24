import mongoose from 'mongoose';
import { ZONAS_FARMACIA } from './Farmacia.js';

const { Schema, model } = mongoose;

// Tablon de anuncios entre vecinos: segunda mano, regalos, lo que se busca,
// objetos o animales perdidos y encontrados, y ayuda vecinal. Patron Post +
// *_detalle como el resto de secciones.
export const CATEGORIAS_ANUNCIO = ['vendo', 'regalo', 'busco', 'perdido', 'encontrado', 'ayuda'];

// Las mismas tres zonas del municipio que usa el directorio de farmacias.
export const ZONAS_ANUNCIO = ZONAS_FARMACIA;

// Un anuncio deja de verse solo a los 30 dias: un "vendo bici" de hace tres
// meses casi seguro ya no vale. El autor puede renovarlo.
export const DIAS_VIGENCIA_ANUNCIO = 30;
const DIA_MS = 24 * 60 * 60 * 1000;

const anuncioDetalleSchema = new Schema(
  {
    post_id: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      unique: true,
    },
    categoria: {
      type: String,
      enum: CATEGORIAS_ANUNCIO,
      required: [true, 'La categoria del anuncio es obligatoria'],
    },
    // Solo para "vendo" (ver el pre('validate')). 0 es valido: "lo que
    // quieras darme" se escribe en el texto, pero un precio 0 no es un error.
    precio: {
      type: Number,
      min: [0, 'El precio no puede ser negativo'],
      max: [1000000, 'Ese precio no parece real'],
      default: null,
    },
    zona: {
      type: String,
      enum: ZONAS_ANUNCIO,
      default: 'lepe',
    },
    // Vendido, encontrado, ya no hace falta: el autor lo cierra y deja de
    // verse sin borrarlo (los comentarios y el historial siguen).
    cerrado: {
      type: Boolean,
      default: false,
    },
    // "Vale mientras la fecha este en el futuro", como las ofertas de empleo.
    fecha_caducidad: {
      type: Date,
      default: () => new Date(Date.now() + DIAS_VIGENCIA_ANUNCIO * DIA_MS),
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

anuncioDetalleSchema.index({ cerrado: 1, fecha_caducidad: -1 });

anuncioDetalleSchema.pre('validate', function comprobarPrecio(next) {
  if (this.categoria === 'vendo') {
    if (this.precio === null || this.precio === undefined) {
      this.invalidate('precio', 'El precio es obligatorio en un anuncio de "vendo"');
    }
  } else if (this.precio !== null && this.precio !== undefined) {
    this.invalidate('precio', 'Solo los anuncios de "vendo" llevan precio');
  }
  next();
});

anuncioDetalleSchema.methods.estaVigente = function estaVigente(ahora = new Date()) {
  return !this.cerrado && this.fecha_caducidad > ahora;
};

// Renovar: otros 30 dias desde AHORA (no sumados a la caducidad que
// quedara, o renovar diez veces seguidas lo mantendria arriba un año).
anuncioDetalleSchema.methods.renovar = function renovar(ahora = new Date()) {
  if (this.cerrado) throw new Error('Un anuncio cerrado no se renueva');
  this.fecha_caducidad = new Date(ahora.getTime() + DIAS_VIGENCIA_ANUNCIO * DIA_MS);
  return this;
};

export default model('AnuncioDetalle', anuncioDetalleSchema);
