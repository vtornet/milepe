import Usuario from '../models/Usuario.js';
import { firmarToken } from '../utils/jwt.js';
import ErrorHttp from '../utils/ErrorHttp.js';

// Solo estos cuatro campos pueden llegar a Usuario.create: nunca
// req.body directamente. Si se pasara req.body tal cual, cualquiera podria
// registrarse mandando { rol: 'admin' } en el cuerpo de la peticion.
export const registrar = async (req, res, next) => {
  try {
    const { nombre_usuario, nombre, email, contraseña } = req.body;

    const usuario = await Usuario.create({ nombre_usuario, nombre, email, contraseña });
    const token = firmarToken(usuario._id);

    res.status(201).json({ ok: true, token, usuario });
  } catch (error) {
    next(error);
  }
};

export const iniciarSesion = async (req, res, next) => {
  try {
    const { email, contraseña } = req.body;

    if (!email || !contraseña) {
      throw new ErrorHttp(400, 'Email y contraseña son obligatorios');
    }

    const usuario = await Usuario.findOne({ email: email.toLowerCase() }).select('+contraseña');

    // Mismo mensaje tanto si el email no existe como si la contraseña no
    // coincide (y si la cuenta esta desactivada): no le decimos a quien
    // intenta entrar cual de los tres casos es el suyo.
    if (!usuario || !usuario.activo || !(await usuario.compararContraseña(contraseña))) {
      throw new ErrorHttp(401, 'Credenciales invalidas');
    }

    const token = firmarToken(usuario._id);
    res.json({ ok: true, token, usuario });
  } catch (error) {
    next(error);
  }
};

// protegido ya dejo el usuario en req.usuario; esto solo lo devuelve.
export const perfil = async (req, res) => {
  res.json({ ok: true, usuario: req.usuario });
};
