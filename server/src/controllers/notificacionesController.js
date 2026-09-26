import Notificacion from '../models/Notificacion.js';
import ErrorHttp from '../utils/ErrorHttp.js';

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
