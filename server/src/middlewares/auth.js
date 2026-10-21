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

// Como protegido, pero sin exigir sesion: si viene un token valido cuelga
// el usuario, y si no viene -o no vale- deja pasar con req.usuario sin
// definir.
//
// Existe para las paginas que se ven con y sin cuenta pero cambian si hay
// sesion: la ficha de un vecino la lee cualquiera, y solo a quien ha
// entrado se le dice si le sigue y si puede escribirle. Con protegido
// habria que elegir entre esconder la ficha a quien no tiene cuenta o no
// dar nunca la relacion.
//
// Un token malo aqui NO es un error: se ignora y la peticion sigue como
// anonima. Lo contrario convertiria un token caducado en un 401 en una
// pagina publica.
export const opcional = async (req, res, next) => {
  const cabecera = req.headers.authorization;

  if (!cabecera || !cabecera.startsWith('Bearer ')) return next();

  try {
    const payload = verificarToken(cabecera.slice('Bearer '.length));
    const usuario = await Usuario.findById(payload.id);
    if (usuario?.activo) req.usuario = usuario;
  } catch {
    // Anonimo y adelante.
  }

  next();
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
