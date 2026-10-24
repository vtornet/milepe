import mongoose from 'mongoose';
import RegistroModeracion from './RegistroModeracion.js';
import { TIPOS_CONTENIDO_MODERABLE, MOTIVOS_REPORTE } from './constantes.js';
import { camposAsignacion } from '../utils/asignacion.js';

const { Schema, model } = mongoose;

// Un reporte es ahora un documento propio y no una entrada del array
// Post.reportes, que es lo que habia antes. El array no daba para mas: no
// se podia resolver un reporte (ni marcarlo revisado, ni saber quien lo
// reviso), no se podia consultar una cola de pendientes sin recorrer todos
// los posts, y los comentarios no se podian reportar en absoluto -habia que
// reportar el post que los contenia-. Como coleccion, el mismo modelo sirve
// para post y comentario y la cola es una consulta directa.
export const ESTADOS_REPORTE = ['pendiente', 'aceptado', 'rechazado'];

// A partir de este numero de reportes PENDIENTES distintos sobre el mismo
// contenido, se oculta solo en espera de revision manual (no se borra).
// Antes vivia en Post.js; se mueve aqui porque es una regla de los
// reportes, no del post. Solo cuentan los pendientes a proposito: si un
// moderador ya rechazo tres reportes de algo, el cuarto no deberia volver
// a esconderlo apoyandose en los que ya se descartaron.
export const UMBRAL_REPORTES_AUTO_OCULTAR = 3;

const reporteSchema = new Schema(
  {
    reportante_id: {
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
    // Autor del contenido reportado, copiado al crear el reporte: permite
    // ver la cola con "a quien se reporta" sin cruzar con dos colecciones
    // distintas segun contenido_tipo.
    autor_contenido_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    motivo: {
      type: String,
      enum: MOTIVOS_REPORTE,
      required: [true, 'El motivo del reporte es obligatorio'],
    },
    detalle: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    estado: {
      type: String,
      enum: ESTADOS_REPORTE,
      default: 'pendiente',
    },
    moderador_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null,
    },
    fecha_revision: {
      type: Date,
      default: null,
    },
    // Quién del equipo lo está revisando, y hasta cuándo (ver utils/asignacion.js).
    ...camposAsignacion(Schema),
    nota_moderador: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// Un vecino no puede reportar lo mismo dos veces. Antes lo comprobaba
// Post.reportar() recorriendo el array; ahora lo garantiza el indice, que
// aguanta tambien dos peticiones simultaneas.
reporteSchema.index({ reportante_id: 1, contenido_tipo: 1, contenido_id: 1 }, { unique: true });
// La cola de moderacion: pendientes, mas antiguos primero.
reporteSchema.index({ estado: 1, fecha_creacion: 1 });
// Reportes pendientes de un contenido concreto (el umbral de auto-ocultar).
reporteSchema.index({ contenido_tipo: 1, contenido_id: 1, estado: 1 });

reporteSchema.statics.contarPendientes = function contarPendientes(contenidoTipo, contenidoId) {
  return this.countDocuments({
    contenido_tipo: contenidoTipo,
    contenido_id: contenidoId,
    estado: 'pendiente',
  });
};

// Unica forma de crear un reporte. Hace tres cosas que no se pueden
// separar sin que el sistema quede en un estado raro: guarda el reporte,
// comprueba el umbral y, si lo alcanza, oculta el contenido Y deja
// constancia en el registro de auditoria. Esto ultimo es la razon de que
// viva aqui y no en el controlador: la invariante "si algo esta oculto, el
// registro dice por que" no puede depender de que cada sitio que cree un
// reporte se acuerde de registrarlo.
//
// Recibe el documento de contenido ya cargado (el controlador lo necesita
// antes, para devolver 404 si no existe) en vez de volver a buscarlo.
reporteSchema.statics.registrar = async function registrar({
  reportante_id,
  contenido_tipo,
  contenido,
  motivo,
  detalle,
}) {
  let reporte;
  try {
    reporte = await this.create({
      reportante_id,
      contenido_tipo,
      contenido_id: contenido._id,
      autor_contenido_id: contenido.autor_id,
      motivo,
      detalle,
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicado = new Error('Ya habias reportado este contenido');
      duplicado.codigoDuplicado = true;
      throw duplicado;
    }
    throw error;
  }

  if (contenido.estado_moderacion !== 'publicado') {
    return { reporte, autoOcultado: false };
  }

  const pendientes = await this.contarPendientes(contenido_tipo, contenido._id);
  if (pendientes < UMBRAL_REPORTES_AUTO_OCULTAR) {
    return { reporte, autoOcultado: false };
  }

  contenido.estado_moderacion = 'oculto';
  await contenido.save();

  await RegistroModeracion.registrar({
    moderador_id: null, // lo oculto el umbral, no una persona
    accion: 'auto_ocultar',
    contenido_tipo,
    contenido_id: contenido._id,
    autor_contenido_id: contenido.autor_id,
    estado_anterior: 'publicado',
    estado_nuevo: 'oculto',
    nota: `Oculto automaticamente al acumular ${pendientes} reportes pendientes`,
    reporte_id: reporte._id,
  });

  return { reporte, autoOcultado: true };
};

export default model('Reporte', reporteSchema);
