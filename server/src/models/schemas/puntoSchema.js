import { Schema } from 'mongoose';

// Sub-esquema GeoJSON Point reutilizable. Cualquier coleccion que necesite
// "un sitio en el mapa" (QuejaDetalle ahora; NegocioDetalle y EventoDetalle
// mas adelante) lo embebe en su campo de ubicacion y crea su propio indice
// 2dsphere sobre ese campo, porque el indice se declara en el esquema padre.
const puntoSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    // [longitud, latitud], en ese orden (convencion GeoJSON, ojo que es al
    // reves de como solemos decirlo en español).
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(valor) {
          return (
            Array.isArray(valor) &&
            valor.length === 2 &&
            valor[0] >= -180 && valor[0] <= 180 &&
            valor[1] >= -90 && valor[1] <= 90
          );
        },
        message: 'coordinates debe ser [longitud, latitud] dentro de rango valido',
      },
    },
  },
  { _id: false },
);

export default puntoSchema;
