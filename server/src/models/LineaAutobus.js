import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Lineas de autobus que paran en Lepe: el urbano (Autocares Gonca) y las de
// Damas a Huelva, Sevilla y La Antilla. Coleccion aparte, sin Post, como
// Farmacia o ContactoInteres: es informacion que se mantiene, no algo que
// publica un vecino.
//
// Ninguna de las dos empresas da los horarios como datos: se copian de sus
// webs (`fuente`) a scripts/datos/autobuses.json y se cargan con
// scripts/cargar-autobuses.mjs. Si alguna vez publican un feed, solo cambia
// ese paso.
export const TIPOS_LINEA = ['urbano', 'interurbano'];
export const TIPOS_DIA = ['laborables', 'sabados', 'domingos'];

const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const listaDeHoras = {
  type: [String],
  default: [],
  validate: {
    validator: (horas) => horas.every((h) => FORMATO_HORA.test(h)) && horas.every((h, i) => i === 0 || horas[i - 1] < h),
    message: 'Las horas tienen que ir como HH:MM, ordenadas y sin repetir',
  },
};

const sentidoSchema = new Schema(
  {
    desde: { type: String, required: true, trim: true },
    hacia: { type: String, required: true, trim: true },
    // Salidas desde `desde`. Laborables = lunes a viernes.
    horarios: {
      laborables: listaDeHoras,
      sabados: listaDeHoras,
      domingos: listaDeHoras,
    },
  },
  { _id: false },
);

const lineaAutobusSchema = new Schema(
  {
    codigo: { type: String, required: true, unique: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    operador: { type: String, required: true, trim: true },
    tipo: { type: String, enum: TIPOS_LINEA, required: true },
    orden: { type: Number, default: 0 },
    fuente: { type: String, trim: true, default: null },
    telefono: { type: String, trim: true, default: null },
    nota: { type: String, trim: true, default: null },
    sentidos: { type: [sentidoSchema], default: [] },
    // Solo el urbano: cada parada con los minutos que tarda desde la primera
    // (la empresa da la tabla completa y el desfase es siempre el mismo).
    paradas: {
      type: [{ nombre: { type: String, required: true, trim: true }, minutos: { type: Number, min: 0, required: true }, _id: false }],
      default: [],
    },
    // Cuando se copiaron de la web de la empresa por ultima vez.
    revisado_en: { type: Date, default: null },
    activa: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

lineaAutobusSchema.index({ activa: 1, orden: 1 });

export default model('LineaAutobus', lineaAutobusSchema);
