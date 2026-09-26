import Usuario from '../models/Usuario.js';
import Amistad from '../models/Amistad.js';
import Bloqueo from '../models/Bloqueo.js';
import ErrorHttp from '../utils/ErrorHttp.js';

export const enviarSolicitud = async (req, res, next) => {
  try {
    const receptorId = req.params.id;

    if (String(receptorId) === String(req.usuario._id)) {
      throw new ErrorHttp(400, 'No puedes enviarte una solicitud a ti mismo');
    }

    const existeReceptor = await Usuario.exists({ _id: receptorId });
    if (!existeReceptor) {
      throw new ErrorHttp(404, 'Usuario no encontrado');
    }

    if (await Bloqueo.existeEntre(req.usuario._id, receptorId)) {
      throw new ErrorHttp(403, 'No puedes enviar una solicitud a este usuario');
    }

    const existente = await Amistad.existeEntre(req.usuario._id, receptorId);
    if (existente) {
      throw new ErrorHttp(409, existente.estado === 'aceptada' ? 'Ya sois amigos' : 'Ya hay una solicitud pendiente entre vosotros');
    }

    const amistad = await Amistad.create({ solicitante_id: req.usuario._id, receptor_id: receptorId });
    res.status(201).json({ ok: true, amistad });
  } catch (error) {
    next(error);
  }
};

// Solo el receptor de la solicitud puede aceptarla (:id es el solicitante,
// no un id de Amistad: asi el cliente no necesita saber el id del
// documento, solo con quien de la lista de solicitudes esta tratando).
export const aceptarSolicitud = async (req, res, next) => {
  try {
    const amistad = await Amistad.findOne({
      solicitante_id: req.params.id,
      receptor_id: req.usuario._id,
      estado: 'pendiente',
    });

    if (!amistad) {
      throw new ErrorHttp(404, 'No hay una solicitud pendiente de ese usuario');
    }

    amistad.estado = 'aceptada';
    await amistad.save();

    res.json({ ok: true, amistad });
  } catch (error) {
    next(error);
  }
};

// Sirve tanto para rechazar una solicitud pendiente como para deshacer una
// amistad ya aceptada (dejar de ser amigos): en ambos casos, el documento
// desaparece por completo, no queda un estado 'rechazada'/'terminada'.
export const eliminarAmistad = async (req, res, next) => {
  try {
    const amistad = await Amistad.existeEntre(req.usuario._id, req.params.id);

    if (!amistad) {
      throw new ErrorHttp(404, 'No hay amistad ni solicitud pendiente con ese usuario');
    }

    await amistad.deleteOne();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const listarAmigos = async (req, res, next) => {
  try {
    const amistades = await Amistad.find({
      estado: 'aceptada',
      $or: [{ solicitante_id: req.usuario._id }, { receptor_id: req.usuario._id }],
    }).populate('solicitante_id receptor_id', 'nombre_usuario nombre avatar_url');

    const amigos = amistades.map((a) =>
      a.solicitante_id._id.equals(req.usuario._id) ? a.receptor_id : a.solicitante_id,
    );

    res.json({ ok: true, amigos });
  } catch (error) {
    next(error);
  }
};

export const listarSolicitudesPendientes = async (req, res, next) => {
  try {
    const solicitudes = await Amistad.find({ receptor_id: req.usuario._id, estado: 'pendiente' }).populate(
      'solicitante_id',
      'nombre_usuario nombre avatar_url',
    );

    res.json({ ok: true, solicitudes });
  } catch (error) {
    next(error);
  }
};
