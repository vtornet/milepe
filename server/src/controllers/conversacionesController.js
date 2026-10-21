import Usuario from '../models/Usuario.js';
import Conversacion from '../models/Conversacion.js';
import Mensaje from '../models/Mensaje.js';
import Bloqueo from '../models/Bloqueo.js';
import Seguimiento from '../models/Seguimiento.js';
import Notificacion from '../models/Notificacion.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { CAMPOS_PUBLICOS_USUARIO } from '../models/constantes.js';
import { avisarPorPush } from '../utils/push.js';
import { emitir } from '../utils/tiempoReal.js';

const MENSAJES_POR_PAGINA = 50;

// Un mensaje retirado por moderacion se devuelve sin texto, igual que un
// comentario borrado: se conserva la fila para que el hilo siga teniendo
// sentido -y para que se vea que ahi habia algo- pero lo que se retiro no
// vuelve a viajar. El autor si va, al contrario que en un comentario: en
// una conversacion de dos, saber quien lo escribio no revela nada que el
// otro no sepa ya.
const mensajeParaElCliente = (mensaje) => {
  if (mensaje.estado_moderacion === 'publicado') return mensaje.toJSON();

  return {
    _id: mensaje._id,
    conversacion_id: mensaje.conversacion_id,
    autor_id: mensaje.autor_id,
    fecha_creacion: mensaje.fecha_creacion,
    leido_en: mensaje.leido_en,
    retirado: 'moderacion',
  };
};

// Carga la conversacion comprobando que quien la pide es uno de los dos
// participantes. Es la comprobacion critica de toda la mensajeria: sin
// ella, cualquiera con un id de conversacion leeria un hilo ajeno. Por eso
// esta en un solo sitio y la usan todas las rutas de mensajes, en vez de
// repetirla en cada una. Devuelve 404 y no 403 a proposito: a quien no es
// participante no se le confirma ni que ese hilo existe.
const cargarConversacionPropia = async (conversacionId, usuarioId) => {
  const conversacion = await Conversacion.findOne({
    _id: conversacionId,
    participantes: usuarioId,
  });

  if (!conversacion) {
    throw new ErrorHttp(404, 'Conversacion no encontrada');
  }

  return conversacion;
};

// La puerta de los mensajes privados: se escriben dos vecinos que se
// siguen MUTUAMENTE, y ninguno de los dos ha bloqueado al otro.
//
// Mutuo y no "yo le sigo" porque seguir es unilateral: si bastase con
// seguir, cualquiera podria abrirse el canal para escribirle a quien
// quisiera con solo pulsar un boton, que es exactamente el problema que
// tiene el mensaje directo de una red abierta. Exigiendo los dos sentidos,
// recibir un privado implica que tu tambien decidiste seguir a esa
// persona.
//
// Devuelve un 403 con razon para que el cliente sepa distinguir "os
// teneis que seguir" de "te ha bloqueado" sin leer el texto del mensaje.
const canalAbierto = async (usuarioId, otroId) => {
  if (await Bloqueo.existeEntre(usuarioId, otroId)) {
    return { abierto: false, razon: 'bloqueo' };
  }
  if (!(await Seguimiento.seSiguenMutuamente(usuarioId, otroId))) {
    return { abierto: false, razon: 'sin_seguimiento_mutuo' };
  }
  return { abierto: true, razon: null };
};

const exigirCanalAbierto = async (usuarioId, otroId) => {
  const { abierto, razon } = await canalAbierto(usuarioId, otroId);
  if (abierto) return;

  const mensaje =
    razon === 'bloqueo'
      ? 'No puedes enviar mensajes a este usuario'
      : 'Para escribiros teneis que seguiros mutuamente';

  throw Object.assign(new ErrorHttp(403, mensaje), { razon });
};

// El "con quien hablo": en una conversacion de dos, el participante que no
// soy yo. Sirve igual con participantes sin poblar que poblados porque un
// ObjectId devuelve a si mismo por ._id (comprobado), asi que no hace falta
// distinguir los dos casos.
const otroParticipante = (conversacion, usuarioId) =>
  conversacion.participantes.find((participante) => String(participante._id) !== String(usuarioId));

// Avisa al destinatario de que tiene un mensaje nuevo, pero solo si no
// tiene ya un aviso sin leer de esta misma conversacion: en un ida y vuelta
// de veinte mensajes, veinte notificaciones no informan de nada mas que
// una, y ademas sepultan el resto del panel de avisos.
const notificarMensajeNuevo = async ({ destinatarioId, remitente, conversacionId }) => {
  const yaAvisado = await Notificacion.exists({
    usuario_id: destinatarioId,
    tipo: 'mensaje_nuevo',
    referencia_id: conversacionId,
    leida: false,
  });

  if (yaAvisado) return;

  await Notificacion.create({
    usuario_id: destinatarioId,
    tipo: 'mensaje_nuevo',
    mensaje: `${remitente.nombre_usuario} te ha enviado un mensaje`,
    referencia_id: conversacionId,
    referencia_tipo: 'conversacion',
  });
};

// Mis conversaciones para la bandeja de entrada, con el otro participante y
// los no leidos de cada hilo. El contador se consulta hilo por hilo en vez
// de con una agregacion: a esta escala -un vecino tiene unas pocas
// conversaciones- es mas legible y la diferencia no se nota. Si algun dia
// alguien acumula cientos de hilos, esto pasaria a un $lookup con $group.
export const listarConversaciones = async (req, res, next) => {
  try {
    const conversaciones = await Conversacion.find({ participantes: req.usuario._id })
      .sort({ fecha_actualizacion: -1 })
      .populate('participantes', CAMPOS_PUBLICOS_USUARIO);

    const resultado = await Promise.all(
      conversaciones.map(async (conversacion) => {
        const con = otroParticipante(conversacion, req.usuario._id);
        // Una consulta mas por hilo, igual que el contador de no leidos y
        // por el mismo motivo: un vecino tiene unas pocas conversaciones y
        // esto se lee mucho mejor que una agregacion. Hace falta aqui para
        // que la bandeja pueda marcar los hilos en los que ya no se puede
        // escribir, en vez de descubrirlo al abrirlos.
        const { abierto, razon } = await canalAbierto(req.usuario._id, con?._id);

        return {
          _id: conversacion._id,
          con,
          ultimo_mensaje: conversacion.ultimo_mensaje,
          no_leidos: await Mensaje.contarNoLeidos(conversacion._id, req.usuario._id),
          fecha_actualizacion: conversacion.fecha_actualizacion,
          solo_lectura: !abierto,
          razon_solo_lectura: razon,
        };
      }),
    );

    res.json({ ok: true, conversaciones: resultado });
  } catch (error) {
    next(error);
  }
};

// Abre la conversacion con otro usuario, creandola si no existia. :id es el
// id del OTRO usuario, no de la conversacion (mismo criterio que
// /api/seguimientos/:id: el cliente sabe con quien quiere hablar, no tiene por
// que conocer el id del hilo). Idempotente: pulsar "escribir a X" dos veces
// devuelve el mismo hilo, no dos.
export const abrirConversacion = async (req, res, next) => {
  try {
    const otroId = req.params.id;

    if (String(otroId) === String(req.usuario._id)) {
      throw new ErrorHttp(400, 'No puedes abrir una conversacion contigo mismo');
    }

    const otro = await Usuario.findById(otroId).select(CAMPOS_PUBLICOS_USUARIO);
    if (!otro) {
      throw new ErrorHttp(404, 'Usuario no encontrado');
    }

    await exigirCanalAbierto(req.usuario._id, otroId);

    const conversacion = await Conversacion.obtenerOCrear(req.usuario._id, otroId);

    res.json({
      ok: true,
      conversacion: {
        _id: conversacion._id,
        con: otro,
        ultimo_mensaje: conversacion.ultimo_mensaje,
        fecha_actualizacion: conversacion.fecha_actualizacion,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Mensajes de un hilo, en orden cronologico. Paginado hacia atras con
// ?antes=<fecha ISO>: al abrir el hilo se piden los ultimos 50 y, al subir,
// los 50 anteriores al mas antiguo que ya se tiene. Se consultan los mas
// recientes (orden descendente + limite) y se le da la vuelta al array
// antes de responder, porque lo que hay que ver al abrir un chat es el
// final de la conversacion, no el principio.
export const listarMensajes = async (req, res, next) => {
  try {
    const conversacion = await cargarConversacionPropia(req.params.id, req.usuario._id);

    const filtro = { conversacion_id: conversacion._id };

    if (req.query.antes) {
      const antes = new Date(req.query.antes);
      if (Number.isNaN(antes.getTime())) {
        throw new ErrorHttp(400, 'El parametro "antes" debe ser una fecha valida');
      }
      filtro.fecha_creacion = { $lt: antes };
    }

    const mensajes = await Mensaje.find(filtro)
      .sort({ fecha_creacion: -1 })
      .limit(MENSAJES_POR_PAGINA)
      .populate('autor_id', CAMPOS_PUBLICOS_USUARIO);

    // Se devuelve tambien con quien es el hilo, y no solo los mensajes,
    // porque si no el cliente no sabria a quien poner en el encabezado de
    // una conversacion recien abierta (que todavia no tiene ni un mensaje
    // del que sacar el autor).
    await conversacion.populate('participantes', CAMPOS_PUBLICOS_USUARIO);

    const con = otroParticipante(conversacion, req.usuario._id);

    // Leer un hilo propio NO exige seguimiento mutuo, solo escribir en el.
    // Dejar de seguir a alguien no borra lo que os dijisteis: la
    // conversacion se queda entera y en solo lectura. Borrarla seria
    // destruir el historial de los DOS por la decision de uno.
    const { abierto, razon } = await canalAbierto(req.usuario._id, con?._id);

    res.json({
      ok: true,
      con,
      mensajes: mensajes.reverse().map(mensajeParaElCliente),
      solo_lectura: !abierto,
      razon_solo_lectura: razon,
    });
  } catch (error) {
    next(error);
  }
};

export const enviarMensaje = async (req, res, next) => {
  try {
    const conversacion = await cargarConversacionPropia(req.params.id, req.usuario._id);
    const destinatarioId = otroParticipante(conversacion, req.usuario._id);

    // La puerta se comprueba tambien al enviar, no solo al abrir el hilo:
    // la conversacion puede llevar meses abierta, y el bloqueo -o el
    // "dejar de seguir"- ser de ayer. Una comprobacion unica al crear
    // dejaria un canal permanente abierto para siempre.
    await exigirCanalAbierto(req.usuario._id, destinatarioId);

    const mensaje = await Mensaje.create({
      conversacion_id: conversacion._id,
      autor_id: req.usuario._id,
      texto: req.body.texto,
    });

    await notificarMensajeNuevo({
      destinatarioId,
      remitente: req.usuario,
      conversacionId: conversacion._id,
    });

    await avisarPorPush({
      usuarioId: destinatarioId,
      titulo: req.usuario.nombre_usuario,
      // El texto del mensaje va en el aviso: un push que solo dice "tienes
      // un mensaje" obliga a abrir la aplicacion para saber si importa.
      cuerpo: mensaje.texto,
      ruta: `/mensajes/${conversacion._id}`,
      // Todos los mensajes del mismo hilo comparten etiqueta, asi que el
      // aviso se sustituye en vez de apilarse veinte veces.
      etiqueta: `conversacion:${conversacion._id}`,
    });

    emitir(destinatarioId, 'mensaje_nuevo', { conversacion_id: conversacion._id });

    await mensaje.populate('autor_id', CAMPOS_PUBLICOS_USUARIO);

    res.status(201).json({ ok: true, mensaje });
  } catch (error) {
    next(error);
  }
};

// Marcar leido es una accion aparte y no un efecto de GET /mensajes a
// proposito: asi una peticion que solo lee no cambia datos, y el cliente
// puede cargar un hilo sin darlo por leido. Tambien apaga el aviso del
// panel de notificaciones, que si no se quedaria encendido despues de
// haber leido ya la conversacion.
export const marcarLeida = async (req, res, next) => {
  try {
    const conversacion = await cargarConversacionPropia(req.params.id, req.usuario._id);

    const marcados = await Mensaje.marcarLeidos(conversacion._id, req.usuario._id);

    await Notificacion.updateMany(
      {
        usuario_id: req.usuario._id,
        tipo: 'mensaje_nuevo',
        referencia_id: conversacion._id,
        leida: false,
      },
      { $set: { leida: true } },
    );

    res.json({ ok: true, marcados });
  } catch (error) {
    next(error);
  }
};
