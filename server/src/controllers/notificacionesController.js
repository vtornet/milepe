import Notificacion from '../models/Notificacion.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import Suscripcion from '../models/Suscripcion.js';
import { clavePublicaPush } from '../utils/push.js';

export const listarNotificaciones = async (req, res, next) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 20));

    const filtro = { usuario_id: req.usuario._id };

    const [notificaciones, total, sinLeer] = await Promise.all([
      Notificacion.find(filtro)
        .sort({ fecha_creacion: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite),
      Notificacion.countDocuments(filtro),
      Notificacion.countDocuments({ ...filtro, leida: false }),
    ]);

    res.json({
      ok: true,
      notificaciones,
      sin_leer: sinLeer,
      paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (error) {
    next(error);
  }
};

export const marcarLeida = async (req, res, next) => {
  try {
    const notificacion = await Notificacion.findOne({ _id: req.params.id, usuario_id: req.usuario._id });

    if (!notificacion) {
      throw new ErrorHttp(404, 'Notificacion no encontrada');
    }

    notificacion.leida = true;
    await notificacion.save();

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const marcarTodasLeidas = async (req, res, next) => {
  try {
    await Notificacion.updateMany({ usuario_id: req.usuario._id, leida: false }, { leida: true });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

// --- Avisos push del navegador ---

// La clave publica VAPID. Se sirve desde aqui en vez de meterla en el
// .env del cliente para que no puedan desincronizarse: una clave publica
// distinta de la privada del servidor produce suscripciones que parecen
// correctas y fallan solo al intentar enviar, que es el peor sitio para
// descubrirlo.
export const clavePublicaParaSuscribirse = (req, res) => {
  res.json({ ok: true, clave: clavePublicaPush() });
};

// Guarda (o actualiza) la suscripcion de ESTE navegador.
//
// Es un upsert por endpoint, no un insert: el endpoint identifica al
// navegador, y si en un movil compartido entra otro vecino, su suscripcion
// tiene que cambiar de dueno, no chocar con la que ya habia.
export const guardarSuscripcion = async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;

    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
      throw new ErrorHttp(400, 'endpoint no valido');
    }
    if (!keys?.p256dh || !keys?.auth) {
      throw new ErrorHttp(400, 'Faltan las claves de la suscripcion');
    }

    await Suscripcion.findOneAndUpdate(
      { endpoint },
      { usuario_id: req.usuario._id, endpoint, claves: { p256dh: keys.p256dh, auth: keys.auth } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
};

// Dejar de recibir avisos en este navegador. Filtra tambien por usuario:
// con el endpoint de otro no se le quitan los avisos a nadie.
export const borrarSuscripcion = async (req, res, next) => {
  try {
    await Suscripcion.deleteOne({ endpoint: req.body?.endpoint, usuario_id: req.usuario._id });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
