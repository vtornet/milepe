import mongoose from 'mongoose';
import puntoSchema from './schemas/puntoSchema.js';

const { Schema, model } = mongoose;

// Categoria de la agenda. Es un filtro, no una taxonomia cerrada del mundo:
// si con el tiempo hace falta otra, se añade sin tocar los eventos ya
// guardados (quedarian como 'otro' hasta que se editen).
export const CATEGORIAS_EVENTO = ['feria', 'fiesta_patronal', 'concierto', 'deportivo', 'cultural', 'otro'];

const eventoDetalleSchema = new Schema(
  {
    // Relacion 1 a 1 con su Post (tipo: 'evento'). Lo generico (titulo,
    // contenido, imagenes del cartel) vive en Post; aqui solo la agenda.
    post_id: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      unique: true,
    },
    categoria: {
      type: String,
      enum: CATEGORIAS_EVENTO,
      required: [true, 'La categoria del evento es obligatoria'],
    },
    fecha_inicio: {
      type: Date,
      required: [true, 'La fecha de inicio del evento es obligatoria'],
    },
    // Opcional: solo los eventos de mas de un dia (ferias, fiestas
    // patronales) la necesitan. Un concierto de una tarde no la lleva.
    fecha_fin: {
      type: Date,
      default: null,
    },
    lugar: {
      type: String,
      required: [true, 'El lugar del evento es obligatorio'],
      trim: true,
      maxlength: 150,
    },
    // Punto en el mapa, opcional: un evento se puede publicar sin pin
    // todavia (p. ej. "recinto ferial, ubicacion a confirmar") y añadirlo
    // despues sin tocar nada mas.
    ubicacion: {
      type: puntoSchema,
      default: null,
    },
    // Publicidad de eventos patrocinados (monetizacion). Mismo patron que
    // NegocioDetalle.destacado_hasta: el evento esta patrocinado mientras
    // patrocinado_hasta sea futuro, en vez de guardar un booleano suelto
    // que alguien tiene que acordarse de apagar.
    patrocinado_hasta: {
      type: Date,
      default: null,
    },
    patrocinador_nombre: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

eventoDetalleSchema.pre('validate', function comprobarFechas(next) {
  if (this.fecha_fin && this.fecha_inicio && this.fecha_fin < this.fecha_inicio) {
    this.invalidate('fecha_fin', 'La fecha de fin no puede ser anterior a la fecha de inicio');
  }
  next();
});

// Agenda ordenada cronologicamente (lo mas proximo primero).
eventoDetalleSchema.index({ fecha_inicio: 1 });
// Filtro de la seccion por categoria, tambien ordenado por fecha.
eventoDetalleSchema.index({ categoria: 1, fecha_inicio: 1 });
// Mapa de eventos. Los documentos sin ubicacion simplemente no entran en
// las consultas geoespaciales, no hace falta marcar el indice como sparse.
eventoDetalleSchema.index({ ubicacion: '2dsphere' });

// True si el evento tiene publicidad patrocinada vigente ahora mismo.
eventoDetalleSchema.methods.estaPatrocinado = function estaPatrocinado() {
  return Boolean(this.patrocinado_hasta && this.patrocinado_hasta > new Date());
};

export default model('EventoDetalle', eventoDetalleSchema);
