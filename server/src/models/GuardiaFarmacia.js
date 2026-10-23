import mongoose from 'mongoose';
import { esDiaValido } from '../utils/guardiaFarmacia.js';

const { Schema, model } = mongoose;

// Una farmacia de guardia un dia. `dia` es un texto "AAAA-MM-DD" y no un
// Date: la guardia es "el 3 de octubre", no un instante, y un Date a
// medianoche cambia de dia segun la zona horaria del servidor.
//
// Un dia puede tener varias filas (una guardia de 24 horas y otra de dia,
// o Lepe y La Antilla a la vez): por eso el unico indice unico es el par
// (dia, farmacia) y no el dia solo.
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
    // Aclaracion corta de ese turno ("de 9:30 a 22:00").
    nota: { type: String, trim: true, maxlength: 100, default: null },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

guardiaFarmaciaSchema.index({ dia: 1, farmacia_id: 1 }, { unique: true });

export default model('GuardiaFarmacia', guardiaFarmaciaSchema);
