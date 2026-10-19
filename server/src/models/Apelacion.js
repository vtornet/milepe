import mongoose from 'mongoose';
import { TIPOS_CONTENIDO_MODERABLE } from './constantes.js';

const { Schema, model } = mongoose;

// La apelacion del autor contra una decision de moderacion sobre lo que
// publico. Apunta al CONTENIDO, no al reporte que lo origino, porque algo
// se puede ocultar sin que medie ningun reporte concreto (un moderador que
// lo ve por su cuenta, o el umbral automatico sumando varios): lo que el
// autor apela es "mi post esta oculto", no "el reporte numero tres".
export const ESTADOS_APELACION = ['pendiente', 'aceptada', 'rechazada'];

const apelacionSchema = new Schema(
  {
    autor_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    contenido_tipo: {
      type: String,
      enum: TIPOS_CONTENIDO_MODERABLE,
      required: true,
    },
    contenido_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    texto: {
      type: String,
      required: [true, 'Explica por que apelas la decision'],
      trim: true,
      maxlength: 2000,
    },
    estado: {
      type: String,
      enum: ESTADOS_APELACION,
      default: 'pendiente',
    },
    // Quien resolvio la apelacion. No es 'moderador_id' como en Reporte a
    // proposito: una apelacion la revisa un admin, y nunca quien tomo la
    // decision apelada (lo exige el controlador), asi que llamarlo
    // 'revisor_id' evita dar por hecho que es el mismo papel.
    revisor_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null,
    },
    fecha_revision: {
      type: Date,
      default: null,
    },
    // La contestacion que recibe el autor. Obligatoria al resolver (lo
    // exige el controlador): una apelacion rechazada sin motivo es lo
    // mismo que no haber respondido.
    respuesta: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// Una sola apelacion por contenido y autor, resuelta o no: la decision de
// una apelacion es final y no se puede volver a litigar reenviandola una y
// otra vez. El indice es unico a secas, no parcial sobre 'pendiente',
// justo por eso.
apelacionSchema.index({ autor_id: 1, contenido_tipo: 1, contenido_id: 1 }, { unique: true });
// La cola de apelaciones: pendientes, mas antiguas primero.
apelacionSchema.index({ estado: 1, fecha_creacion: 1 });

export default model('Apelacion', apelacionSchema);
