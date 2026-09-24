import jwt from 'jsonwebtoken';

// Firma un token con el id del usuario como unico dato. Cualquier otra cosa
// que un endpoint necesite saber del usuario se consulta con ese id, no se
// mete en el payload (asi un cambio de rol no exige esperar a que caduque
// el token viejo).
export const firmarToken = (usuarioId) =>
  jwt.sign({ id: usuarioId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Lanza JsonWebTokenError / TokenExpiredError si el token no es valido; el
// middleware de autenticacion es quien las captura y traduce a un 401.
export const verificarToken = (token) => jwt.verify(token, process.env.JWT_SECRET);
