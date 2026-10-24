import mongoose from 'mongoose';
import { ESTADOS_MODERACION } from './Post.js';
import { TIPOS_CONTENIDO_MODERABLE } from './constantes.js';

const { Schema, model } = mongoose;

// Registro de auditoria de moderacion: quien hizo que, sobre que, cuando y
// por que. Es lo que permite responder "por que se oculto esto" meses
// despues y revisar el criterio de un moderador, que es justo lo que
// Post.moderador_id -un solo campo, sobrescrito en cada accion- no podia:
// ahi solo quedaba la ultima accion y nada de lo anterior.
export const ACCIONES_MODERACION = [
  // Cambios de estado_moderacion hechos por una persona.
  'ocultar',
  'eliminar',
  'restaurar',
  // Ocultado solo al alcanzar el umbral de reportes: sin moderador_id.
  'auto_ocultar',
  // Resolucion de un reporte (puede o no venir acompañada de un cambio de
  // estado: rechazar un reporte no toca el contenido).
  'reporte_aceptado',
  'reporte_rechazado',
  // Resolucion de una apelacion del autor del contenido.
  'apelacion_aceptada',
  'apelacion_rechazada',
  // Edicion del autor que cambia las imagenes: el post no deja de estar
  // visible, solo entra en la cola de revision. La marca la pone el
  // sistema, asi que tambien va con moderador_id null; y como no toca la
  // visibilidad, estado_anterior y estado_nuevo van nulos, igual que al
  // rechazar un reporte.
  'revision_por_edicion',
  'edicion_aprobada',
  // Sobre una cuenta, no sobre un contenido (contenido_tipo 'usuario', y
  // contenido_id y autor_contenido_id son la propia cuenta).
  'cuenta_suspendida',
  'suspension_levantada',
];

const registroSchema = new Schema(
  {
    // null cuando la accion la tomo el sistema (auto_ocultar por umbral de
    // reportes). Que sea nulo es informacion, no un hueco: distingue "lo
    // oculto el umbral" de "lo oculto alguien".
    moderador_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null,
    },
    accion: {
      type: String,
      enum: ACCIONES_MODERACION,
      required: [true, 'La accion es obligatoria'],
    },
    contenido_tipo: {
      type: String,
      // 'usuario' solo para suspender/levantar: no es contenido reportable,
      // asi que no entra en TIPOS_CONTENIDO_MODERABLE.
      enum: [...TIPOS_CONTENIDO_MODERABLE, 'usuario'],
      required: true,
    },
    contenido_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    // Autor del contenido moderado, copiado aqui a proposito. Sin esto,
    // "que se le ha hecho a este vecino" exigiria cruzar con dos
    // colecciones distintas (posts y comentarios) segun contenido_tipo; y
    // si el contenido se purgase algun dia, el historial de la persona
    // seguiria siendo legible.
    autor_contenido_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    // Ambos nulos cuando la accion no cambia la visibilidad (p. ej.
    // rechazar un reporte).
    estado_anterior: {
      type: String,
      enum: [...ESTADOS_MODERACION, null],
      default: null,
    },
    estado_nuevo: {
      type: String,
      enum: [...ESTADOS_MODERACION, null],
      default: null,
    },
    // El "por que". En una accion manual lo escribe el moderador; en
    // auto_ocultar lo rellena el sistema.
    nota: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    reporte_id: {
      type: Schema.Types.ObjectId,
      ref: 'Reporte',
      default: null,
    },
    apelacion_id: {
      type: Schema.Types.ObjectId,
      ref: 'Apelacion',
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// Historial completo, lo mas reciente primero (la vista por defecto).
registroSchema.index({ fecha_creacion: -1 });
// "Que se ha hecho con este contenido" (el uso al resolver una apelacion).
registroSchema.index({ contenido_tipo: 1, contenido_id: 1, fecha_creacion: -1 });
// "Que se le ha hecho a este vecino" y "que ha hecho este moderador".
registroSchema.index({ autor_contenido_id: 1, fecha_creacion: -1 });
registroSchema.index({ moderador_id: 1, fecha_creacion: -1 });

// Solo se añade: un registro de auditoria que se puede reescribir o borrar
// no sirve para auditar nada. Esto es una barrera de la aplicacion, no de
// la base de datos (quien tenga acceso directo a Mongo puede hacer lo que
// quiera), pero impide el borrado accidental desde el codigo, que es el
// riesgo real aqui.
const PROHIBIDO = 'El registro de moderacion es de solo añadir: no se puede modificar ni borrar';

registroSchema.pre('save', function impedirModificacion(next) {
  if (!this.isNew) {
    next(new Error(PROHIBIDO));
    return;
  }
  next();
});

registroSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne'],
  function impedirActualizacion(next) {
    next(new Error(PROHIBIDO));
  },
);

registroSchema.pre(
  ['deleteOne', 'deleteMany', 'findOneAndDelete'],
  { document: true, query: true },
  function impedirBorrado(next) {
    next(new Error(PROHIBIDO));
  },
);

// Unica puerta para escribir en el registro. No hace mas que create(), pero
// tenerla con nombre deja claro en cada controlador que lo que se esta
// haciendo es dejar constancia, y da un sitio donde añadir despues lo que
// toda entrada deba llevar.
registroSchema.statics.registrar = function registrar(datos) {
  return this.create(datos);
};

export default model('RegistroModeracion', registroSchema);
