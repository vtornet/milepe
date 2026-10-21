import Usuario from '../models/Usuario.js';
import Seguimiento from '../models/Seguimiento.js';
import Bloqueo from '../models/Bloqueo.js';
import Notificacion from '../models/Notificacion.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { CAMPOS_PUBLICOS_USUARIO } from '../models/constantes.js';
import { avisarPorPush } from '../utils/push.js';

// Tope de las listas de seguidores/seguidos que se devuelven de una vez.
// No estan paginadas porque el uso real es "cargar a quien sigo para
// pintar los botones del muro", que necesita la lista entera; a escala de
// un pueblo eso son decenas de filas. El tope esta para que un caso raro
// no se convierta en una respuesta de megabytes.
const TOPE_LISTA = 2000;

export const seguir = async (req, res, next) => {
  try {
    const seguidoId = req.params.id;

    if (String(seguidoId) === String(req.usuario._id)) {
      throw new ErrorHttp(400, 'No puedes seguirte a ti mismo');
    }

    const existe = await Usuario.exists({ _id: seguidoId });
    if (!existe) {
      throw new ErrorHttp(404, 'Usuario no encontrado');
    }

    if (await Bloqueo.existeEntre(req.usuario._id, seguidoId)) {
      // Sin decir en qué dirección: que te digan "te ha bloqueado" al
      // intentar seguir a alguien es información que no hace falta dar.
      throw new ErrorHttp(403, 'No puedes seguir a este usuario');
    }

    let creado = true;
    try {
      await Seguimiento.create({ seguidor_id: req.usuario._id, seguido_id: seguidoId });
    } catch (error) {
      // Pulsar "seguir" dos veces -o con la conexión a medias- no es un
      // error: ya estabas siguiendo, que es lo que querías. El índice
      // único es el que lo impide de verdad; aquí solo se interpreta.
      if (error.code === 11000) creado = false;
      else throw error;
    }

    const estado = await Seguimiento.estadoEntre(req.usuario._id, seguidoId);

    // Solo se avisa cuando el seguimiento es nuevo. Sin esto, dos pulsados
    // seguidos mandan dos avisos iguales.
    if (creado) {
      await Notificacion.create({
        usuario_id: seguidoId,
        tipo: 'seguidor_nuevo',
        mensaje: estado.mutuo
          ? `${req.usuario.nombre_usuario} también te sigue: ya podéis escribiros`
          : `${req.usuario.nombre_usuario} ha empezado a seguirte`,
        referencia_id: req.usuario._id,
        referencia_tipo: 'usuario',
      });

      await avisarPorPush({
        usuarioId: seguidoId,
        titulo: 'Nuevo seguidor en MiLepe',
        cuerpo: `${req.usuario.nombre_usuario} ha empezado a seguirte`,
        ruta: `/vecino/${req.usuario._id}`,
      });
    }

    res.status(creado ? 201 : 200).json({ ok: true, ...estado });
  } catch (error) {
    next(error);
  }
};

// Dejar de seguir. No hace falta comprobar que existía: borrar algo que no
// está deja las cosas como quien lo pide quiere que estén.
//
// Esto es lo que vuelve de solo lectura una conversación con esa persona
// (ver conversacionesController): el hilo se queda, con todo lo escrito,
// pero no se puede escribir más hasta que vuelva a haber seguimiento
// mutuo.
export const dejarDeSeguir = async (req, res, next) => {
  try {
    await Seguimiento.deleteOne({ seguidor_id: req.usuario._id, seguido_id: req.params.id });

    const estado = await Seguimiento.estadoEntre(req.usuario._id, req.params.id);

    res.json({ ok: true, ...estado });
  } catch (error) {
    next(error);
  }
};

// A quién sigue alguien. Sin ?usuario, yo.
export const listarSeguidos = async (req, res, next) => {
  try {
    const usuarioId = req.query.usuario || req.usuario._id;

    const filas = await Seguimiento.find({ seguidor_id: usuarioId })
      .sort({ fecha_creacion: -1 })
      .limit(TOPE_LISTA)
      .populate('seguido_id', CAMPOS_PUBLICOS_USUARIO);

    res.json({
      ok: true,
      // Se devuelven los usuarios, no las filas de seguimiento: el id del
      // documento intermedio no le sirve a nadie, porque dejar de seguir
      // se hace con el id de la persona.
      usuarios: filas.map((fila) => fila.seguido_id).filter(Boolean),
    });
  } catch (error) {
    next(error);
  }
};

export const listarSeguidores = async (req, res, next) => {
  try {
    const usuarioId = req.query.usuario || req.usuario._id;

    const filas = await Seguimiento.find({ seguido_id: usuarioId })
      .sort({ fecha_creacion: -1 })
      .limit(TOPE_LISTA)
      .populate('seguidor_id', CAMPOS_PUBLICOS_USUARIO);

    res.json({ ok: true, usuarios: filas.map((fila) => fila.seguidor_id).filter(Boolean) });
  } catch (error) {
    next(error);
  }
};

// Mi relación con alguien, de una vez: si le sigo, si me sigue, y si por
// tanto podemos escribirnos. Lo usa la ficha de un vecino para pintar los
// dos botones sin tener que deducirlo de dos listas.
export const estadoCon = async (req, res, next) => {
  try {
    const estado = await Seguimiento.estadoEntre(req.usuario._id, req.params.id);
    const bloqueado = Boolean(await Bloqueo.existeEntre(req.usuario._id, req.params.id));

    res.json({
      ok: true,
      ...estado,
      // Lo que el cliente necesita saber para el botón de escribir, ya
      // resuelto aquí: así no repite la regla (mutuo y sin bloqueo) en
      // pantalla, donde se quedaría desactualizada el día que cambie.
      puede_escribir: estado.mutuo && !bloqueado,
    });
  } catch (error) {
    next(error);
  }
};
