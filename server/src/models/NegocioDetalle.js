import mongoose from 'mongoose';
import puntoSchema from './schemas/puntoSchema.js';

const { Schema, model } = mongoose;

export const CATEGORIAS_NEGOCIO = ['restauracion', 'alojamiento', 'comercio', 'servicios', 'ocio', 'otros'];

const DIAS_DESTACADO_POR_DEFECTO = 30;

const negocioDetalleSchema = new Schema(
  {
    // Relacion 1 a 1 con su Post (tipo: 'negocio'). Lo generico (nombre
    // como titulo, descripcion como contenido, fotos) vive en Post; aqui
    // solo la ficha del directorio. Las reseñas no van aqui: reutilizan
    // Comentario (con un campo opcional de valoracion), no una coleccion
    // aparte.
    post_id: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      unique: true,
    },
    categoria: {
      type: String,
      enum: CATEGORIAS_NEGOCIO,
      required: [true, 'La categoria del negocio es obligatoria'],
    },
    direccion: {
      type: String,
      required: [true, 'La direccion del negocio es obligatoria'],
      trim: true,
      maxlength: 200,
    },
    // Un directorio local sin pin en el mapa pierde buena parte de su
    // utilidad, asi que aqui si es obligatoria (a diferencia de eventos).
    ubicacion: {
      type: puntoSchema,
      required: [true, 'La ubicacion del negocio es obligatoria'],
    },
    telefono: {
      type: String,
      trim: true,
      maxlength: 20,
      default: null,
    },
    // Texto libre ("L-V 9:00-14:00 y 17:00-20:00, S 9:00-14:00") en vez de
    // una estructura por dia: cubre horarios irregulares (cierre por
    // vacaciones, horario de verano...) sin que el esquema tenga que
    // preverlos todos.
    horario: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },
    sitio_web: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },
    // Monetizacion: suscripcion mensual via Stripe. El negocio esta
    // destacado mientras esta fecha sea futura; el webhook de Stripe la
    // extiende en cada pago y, si deja de pagar, expira sola sin que haya
    // que cancelar nada a mano.
    destacado_hasta: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// Mapa de negocios (Leaflet: "negocios cerca de mi", filtrar por categoria
// dentro de un area...).
negocioDetalleSchema.index({ ubicacion: '2dsphere' });
// Filtro de la seccion por categoria.
negocioDetalleSchema.index({ categoria: 1 });
// Listar destacados vigentes (destacado_hasta > ahora) primero.
negocioDetalleSchema.index({ destacado_hasta: -1 });

// True si el negocio esta destacado ahora mismo.
negocioDetalleSchema.methods.estaDestacado = function estaDestacado() {
  return Boolean(this.destacado_hasta && this.destacado_hasta > new Date());
};

// La usa el webhook de Stripe en cada pago de la suscripcion. Si ya estaba
// destacado y no habia expirado, extiende desde su fecha actual (para no
// "perder" dias si el pago llega antes de que caduque); si no, cuenta desde
// hoy. No persiste el cambio: el controlador/webhook debe llamar a
// negocioDetalle.save() despues.
negocioDetalleSchema.methods.extenderDestacado = function extenderDestacado(dias = DIAS_DESTACADO_POR_DEFECTO) {
  const base = this.estaDestacado() ? this.destacado_hasta : new Date();
  const nuevaFecha = new Date(base);
  nuevaFecha.setDate(nuevaFecha.getDate() + dias);
  this.destacado_hasta = nuevaFecha;

  return this;
};

export default model('NegocioDetalle', negocioDetalleSchema);
