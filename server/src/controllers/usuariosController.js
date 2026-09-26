import Usuario from '../models/Usuario.js';
import Bloqueo from '../models/Bloqueo.js';
import ErrorHttp from '../utils/ErrorHttp.js';

export const bloquearUsuario = async (req, res, next) => {
  try {
    const bloqueadoId = req.params.id;

    const existe = await Usuario.exists({ _id: bloqueadoId });
    if (!existe) {
      throw new ErrorHttp(404, 'Usuario no encontrado');
    }

    try {
      await Bloqueo.create({ bloqueador_id: req.usuario._id, bloqueado_id: bloqueadoId });
    } catch (error) {
      // El indice unico compuesto {bloqueador_id, bloqueado_id} ya lo
      // impide, pero el mensaje generico del gestor de errores (que solo
      // mira la primera clave de un indice compuesto) queda confuso aqui.
      if (error.code === 11000) {
        throw new ErrorHttp(409, 'Ya tenias bloqueado a este usuario');
      }
      throw error;
    }

    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const desbloquearUsuario = async (req, res, next) => {
  try {
    const resultado = await Bloqueo.deleteOne({ bloqueador_id: req.usuario._id, bloqueado_id: req.params.id });

    if (resultado.deletedCount === 0) {
      throw new ErrorHttp(404, 'No tenias bloqueado a este usuario');
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const listarBloqueados = async (req, res, next) => {
  try {
    const bloqueos = await Bloqueo.find({ bloqueador_id: req.usuario._id }).populate(
      'bloqueado_id',
      'nombre_usuario nombre avatar_url',
    );

    res.json({ ok: true, bloqueados: bloqueos.map((b) => b.bloqueado_id) });
  } catch (error) {
    next(error);
  }
};
