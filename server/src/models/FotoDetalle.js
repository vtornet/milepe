import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export const EPOCAS_FOTO = ['antigua', 'actual'];

// Decada mas antigua aceptada. Lepe tiene fotografia documentada desde
// bastante antes, pero por debajo de esto lo tratamos como "sin decada
// concreta" y se pide como texto libre en el pie de foto, no como filtro.
const DECADA_MINIMA = 1900;

const fotoDetalleSchema = new Schema(
  {
    // Relacion 1 a 1 con su Post (tipo: 'foto'). La imagen en si va en
    // Post.imagenes; aqui solo lo que distingue una foto antigua de una
    // actual para poder filtrar la seccion.
    post_id: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      unique: true,
    },
    epoca: {
      type: String,
      enum: EPOCAS_FOTO,
      required: [true, 'La epoca de la foto es obligatoria'],
    },
    // Año de inicio de la decada (1960, 1970...). Solo tiene sentido si
    // epoca es 'antigua'; se valida mas abajo. Es el filtro opcional de la
    // seccion Fotos > Antiguas.
    decada: {
      type: Number,
      default: null,
      validate: {
        validator(valor) {
          if (valor === null || valor === undefined) return true;
          const decadaActual = Math.floor(new Date().getFullYear() / 10) * 10;
          return Number.isInteger(valor) && valor % 10 === 0 && valor >= DECADA_MINIMA && valor <= decadaActual;
        },
        message: (props) => `${props.value} no es una decada valida`,
      },
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// Reglas cruzadas entre epoca y decada: obligatoria en 'antigua', ausente
// en 'actual'. Van en pre('validate') porque implican a mas de un campo a
// la vez, algo que el validador de un solo campo no puede resolver.
fotoDetalleSchema.pre('validate', function comprobarDecadaSegunEpoca(next) {
  if (this.epoca === 'antigua' && (this.decada === null || this.decada === undefined)) {
    this.invalidate('decada', 'Una foto antigua necesita una decada');
  }

  if (this.epoca === 'actual' && this.decada !== null && this.decada !== undefined) {
    this.invalidate('decada', 'Una foto actual no lleva decada');
  }

  next();
});

// Filtro de la seccion: por epoca y, dentro de "antigua", por decada.
fotoDetalleSchema.index({ epoca: 1, decada: 1 });

export default model('FotoDetalle', fotoDetalleSchema);
