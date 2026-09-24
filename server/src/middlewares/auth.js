import Usuario from '../models/Usuario.js';
import { verificarToken } from '../utils/jwt.js';
import ErrorHttp from '../utils/ErrorHttp.js';

// Exige un JWT valido (cabecera "Authorization: Bearer <token>") y cuelga
// el usuario autenticado en req.usuario para que el resto de la cadena
// (controlador, autorizar()) no tenga que volver a consultarlo.
export const protegido = async (req, res, next) => {
  try {
    const cabecera = req.headers.authorization;

    if (!cabecera || !cabecera.startsWith('Bearer ')) {
      throw new ErrorHttp(401, 'No autenticado');
    }

    const token = cabecera.slice('Bearer '.length);
    const payload = verificarToken(token);

    const usuario = await Usuario.findById(payload.id);
    if (!usuario || !usuario.activo) {
      throw new ErrorHttp(401, 'No autenticado');
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new ErrorHttp(401, 'Token invalido o caducado'));
    }
    next(error);
  }
};

// Se usa despues de protegido: exige que req.usuario.rol este entre los
// permitidos. autorizar('moderador', 'admin') deja pasar a cualquiera de
// los dos, por ejemplo.
export const autorizar = (...rolesPermitidos) => (req, res, next) => {
  if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
    return next(new ErrorHttp(403, 'No tienes permiso para esta accion'));
  }
  next();
};
