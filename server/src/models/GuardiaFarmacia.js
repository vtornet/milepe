import mongoose from 'mongoose';
import {
  DESDE_POR_DEFECTO,
  HASTA_POR_DEFECTO,
  esDiaValido,
  esHoraFinValida,
  esHoraValida,
} from '../utils/guardiaFarmacia.js';

const { Schema, model } = mongoose;

// Una farmacia de guardia un dia, con su horario. `dia` es un texto
// "AAAA-MM-DD" y no un Date: la guardia es "el 3 de octubre", no un instante,
// y un Date a medianoche cambia de dia segun la zona horaria del servidor.
//
// Un dia tiene varias filas (en Lepe, tres diurnas y una de 24 horas), por
// eso el unico indice unico es el par (dia, farmacia) y no el dia solo.
//
// `desde` y `hasta` son la ventana de la guardia ("09:30" a "22:00"). Sin
// ellas vale todo el dia. Si `hasta` no es posterior a `desde`, acaba al dia
// siguiente (ver ventanaDeGuardia). 24 horas se guarda como 00:00 a 24:00.
const guardiaFarmaciaSchema = new Schema(
  {
    dia: {
      type: String,
      required: [true, 'El dia de la guardia es obligatorio'],
      validate: {
        validator: esDiaValido,
        message: 'El dia debe ser una fecha real con formato AAAA-MM-DD',
      },
    },
    farmacia_id: {
      type: Schema.Types.ObjectId,
      ref: 'Farmacia',
      required: [true, 'La farmacia es obligatoria'],
    },
    desde: {
      type: String,
      default: DESDE_POR_DEFECTO,
      validate: { validator: esHoraValida, message: 'desde debe ser una hora HH:MM' },
    },
    hasta: {
      type: String,
      default: HASTA_POR_DEFECTO,
      validate: { validator: esHoraFinValida, message: 'hasta debe ser una hora HH:MM (o 24:00)' },
    },
    // Aclaracion corta de ese turno, si el horario no basta.
    nota: { type: String, trim: true, maxlength: 100, default: null },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

guardiaFarmaciaSchema.index({ dia: 1, farmacia_id: 1 }, { unique: true });

export default model('GuardiaFarmacia', guardiaFarmaciaSchema);
