import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Coincide 1 a 1 con Post.tipo ('empleo_busco' / 'empleo_ofrezco'), pero se
// guarda tambien aqui para poder filtrar EmpleoDetalle sin tener que hacer
// join con Post en cada consulta de la seccion.
export const MODALIDADES_EMPLEO = ['busco', 'ofrezco'];

export const SECTORES_EMPLEO = ['agricola', 'hosteleria', 'construccion', 'comercio', 'otros'];

// El estado de la oferta (no de moderacion, eso es Post.estado_moderacion).
// El cron diario pasa 'activa' -> 'caducada' al llegar fecha_caducidad; solo
// aplica a modalidad 'ofrezco'.
export const ESTADOS_OFERTA = ['activa', 'caducada'];

const DIAS_CADUCIDAD_POR_DEFECTO = 30;

const empleoDetalleSchema = new Schema(
  {
    // Relacion 1 a 1 con su Post. Lo generico (titulo, contenido, imagenes)
    // vive en Post; aqui solo lo especifico de la oferta o la candidatura.
    post_id: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      unique: true,
    },
    modalidad: {
      type: String,
      enum: MODALIDADES_EMPLEO,
      required: [true, 'La modalidad (busco/ofrezco) es obligatoria'],
    },
    // Filtro comun a busco y ofrezco.
    sector: {
      type: String,
      enum: SECTORES_EMPLEO,
      required: [true, 'El sector es obligatorio'],
    },

    // --- Solo modalidad 'busco' ---
    // Texto libre por ahora: la lista concreta de pedanias/zonas de la
    // comarca es algo que conviene que definas tu antes de convertirla en
    // un enum cerrado.
    zona: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },
    // Desde cuando esta disponible el candidato. Si no se indica y la
    // modalidad es 'busco', se asume "disponible ya" (ver pre-validate).
    disponible_desde: {
      type: Date,
      default: null,
    },

    // --- Solo modalidad 'ofrezco' ---
    puesto: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },
    jornal: {
      type: Number,
      min: 0,
      default: null,
    },
    // Si no se indica al crear la oferta, se calcula sola a
    // DIAS_CADUCIDAD_POR_DEFECTO dias vista (ver pre-validate).
    fecha_caducidad: {
      type: Date,
      default: null,
    },
    estado_oferta: {
      type: String,
      enum: ESTADOS_OFERTA,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// Reglas cruzadas segun modalidad: cada variante exige sus campos y no
// admite los de la otra, igual que epoca/decada en FotoDetalle. Los campos
// de conveniencia (disponible_desde, fecha_caducidad, estado_oferta) se
// autocompletan aqui si faltan.
empleoDetalleSchema.pre('validate', function comprobarCamposSegunModalidad(next) {
  if (this.modalidad === 'busco') {
    if (!this.zona) {
      this.invalidate('zona', 'La zona es obligatoria en una publicacion de tipo "busco"');
    }
    if (!this.disponible_desde) {
      this.disponible_desde = new Date();
    }
    if (this.puesto || this.jornal !== null || this.fecha_caducidad || this.estado_oferta) {
      this.invalidate('modalidad', 'Los campos de "ofrezco" (puesto, jornal, caducidad) no aplican a "busco"');
    }
  }

  if (this.modalidad === 'ofrezco') {
    if (!this.puesto) {
      this.invalidate('puesto', 'El puesto es obligatorio en una oferta de tipo "ofrezco"');
    }
    if (this.jornal === null || this.jornal === undefined) {
      this.invalidate('jornal', 'El jornal es obligatorio en una oferta de tipo "ofrezco"');
    }
    if (!this.fecha_caducidad) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() + DIAS_CADUCIDAD_POR_DEFECTO);
      this.fecha_caducidad = fecha;
    }
    if (!this.estado_oferta) {
      this.estado_oferta = 'activa';
    }
    if (this.zona || this.disponible_desde) {
      this.invalidate('modalidad', 'Los campos de "busco" (zona, disponibilidad) no aplican a "ofrezco"');
    }
  }

  next();
});

// Filtro de la seccion: por modalidad, sector y estado de la oferta.
empleoDetalleSchema.index({ modalidad: 1, sector: 1, estado_oferta: 1 });
// El cron diario recorre justo esta combinacion para caducar ofertas.
empleoDetalleSchema.index({ modalidad: 1, estado_oferta: 1, fecha_caducidad: 1 });

// True si una oferta deberia considerarse caducada, haya pasado o no el
// cron todavia. Solo tiene sentido para modalidad 'ofrezco'.
empleoDetalleSchema.methods.estaCaducada = function estaCaducada() {
  if (this.modalidad !== 'ofrezco') return false;
  return this.estado_oferta === 'caducada' || this.fecha_caducidad < new Date();
};

// La usa el cron diario (jobs/caducarEmpleos.js) para marcar una oferta
// vencida sin necesidad de tocar el post ni borrar nada.
empleoDetalleSchema.methods.marcarCaducada = function marcarCaducada() {
  this.estado_oferta = 'caducada';
  return this;
};

// Vuelve a activar una oferta caducada con una nueva fecha de caducidad, sin
// crear un post nuevo. No persiste el cambio: el controlador debe llamar a
// empleoDetalle.save() despues.
empleoDetalleSchema.methods.republicar = function republicar(dias = DIAS_CADUCIDAD_POR_DEFECTO) {
  if (this.modalidad !== 'ofrezco') {
    throw new Error('Solo una oferta ("ofrezco") se puede republicar');
  }

  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  this.fecha_caducidad = fecha;
  this.estado_oferta = 'activa';

  return this;
};

export default model('EmpleoDetalle', empleoDetalleSchema);
