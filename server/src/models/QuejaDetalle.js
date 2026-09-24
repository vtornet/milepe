import mongoose from 'mongoose';
import puntoSchema from './schemas/puntoSchema.js';

const { Schema, model } = mongoose;

export const CATEGORIAS_QUEJA = ['limpieza', 'suministros', 'obras', 'jardineria', 'general'];

// Sin integracion con el ayuntamiento por ahora: el estado lo cambia un
// moderador a mano desde el panel. El orden importa para la UI (barra de
// progreso pendiente -> en_curso -> resuelto).
export const ESTADOS_QUEJA = ['pendiente', 'en_curso', 'resuelto'];

const cambioEstadoSchema = new Schema(
  {
    estado: {
      type: String,
      enum: ESTADOS_QUEJA,
      required: true,
    },
    moderador_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    fecha: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const quejaDetalleSchema = new Schema(
  {
    // Relacion 1 a 1 con su Post (tipo: 'queja'). El feed y el contenido
    // genericos (titulo, contenido, imagenes, likes...) viven en Post; aqui
    // solo lo especifico de una queja.
    post_id: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      unique: true,
    },
    categoria: {
      type: String,
      enum: CATEGORIAS_QUEJA,
      required: [true, 'La categoria de la queja es obligatoria'],
    },
    ubicacion: {
      type: puntoSchema,
      required: [true, 'La ubicacion de la queja es obligatoria'],
    },
    // Texto libre para mostrar algo legible sin depender de geocodificacion
    // inversa (p. ej. "Calle Real, esquina con Plaza de la Iglesia").
    direccion_aproximada: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    estado: {
      type: String,
      enum: ESTADOS_QUEJA,
      default: 'pendiente',
    },
    // Traza cada cambio de estado con quien lo hizo y cuando. Es lo que
    // permite mostrarle al vecino "en curso desde el 12/03" en vez de un
    // simple estado sin contexto.
    historial_estados: {
      type: [cambioEstadoSchema],
      default: [],
    },
    // Se rellena sola al pasar a 'resuelto'; se limpia si se reabre.
    fecha_resolucion: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// Mapa de quejas (Leaflet: "quejas cerca de mi", agrupar por zona...).
quejaDetalleSchema.index({ ubicacion: '2dsphere' });
// Filtro de la seccion: por categoria y/o por estado.
quejaDetalleSchema.index({ categoria: 1, estado: 1 });

// Cambia el estado, deja constancia en el historial y gestiona
// fecha_resolucion. No persiste el cambio: el controlador debe llamar a
// quejaDetalle.save() despues.
quejaDetalleSchema.methods.cambiarEstado = function cambiarEstado(nuevoEstado, moderadorId) {
  if (!ESTADOS_QUEJA.includes(nuevoEstado)) {
    throw new Error(`Estado de queja no valido: ${nuevoEstado}`);
  }

  this.estado = nuevoEstado;
  this.historial_estados.push({ estado: nuevoEstado, moderador_id: moderadorId });
  this.fecha_resolucion = nuevoEstado === 'resuelto' ? new Date() : null;

  return this;
};

export default model('QuejaDetalle', quejaDetalleSchema);
