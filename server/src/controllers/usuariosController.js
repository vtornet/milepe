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

// Escapa lo que el usuario escribe antes de meterlo en una RegExp: sin
// esto, un '(' o un '*' sueltos en el buscador no son una busqueda raruna,
// son una RegExp invalida que revienta la consulta con un 500.
const escaparRegExp = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Buscador de vecinos por nombre de usuario o nombre. Existe porque sin el
// la mensajeria no tendria por donde empezar una conversacion (no hay
// pagina de perfil todavia); el sistema de amigos lo reutilizara igual.
// Devuelve solo campos publicos, un maximo de 10 resultados, y ni a quien
// busca ni a nadie con quien medie un bloqueo: si no puedes escribirle ni
// enviarle solicitud, sacarlo en el buscador solo lleva a un 403.
export const buscarUsuarios = async (req, res, next) => {
  try {
    const consulta = (req.query.q || '').trim();

    // Con menos de dos caracteres la busqueda devolveria media base de
    // datos sin informar de nada.
    if (consulta.length < 2) {
      res.json({ ok: true, usuarios: [] });
      return;
    }

    const patron = new RegExp(escaparRegExp(consulta), 'i');

    const bloqueos = await Bloqueo.find({
      $or: [{ bloqueador_id: req.usuario._id }, { bloqueado_id: req.usuario._id }],
    }).select('bloqueador_id bloqueado_id');

    const excluidos = [req.usuario._id];
    for (const bloqueo of bloqueos) {
      excluidos.push(bloqueo.bloqueador_id, bloqueo.bloqueado_id);
    }

    const usuarios = await Usuario.find({
      _id: { $nin: excluidos },
      activo: true,
      $or: [{ nombre_usuario: patron }, { nombre: patron }],
    })
      .select('nombre_usuario nombre avatar_url')
      .limit(10);

    res.json({ ok: true, usuarios });
  } catch (error) {
    next(error);
  }
};
