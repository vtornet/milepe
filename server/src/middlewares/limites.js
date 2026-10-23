import { rateLimit } from 'express-rate-limit';

// Limites de peticiones por IP. El contador vive en la memoria del proceso
// (el almacen por defecto): vale mientras la API sea una sola instancia,
// que es lo que hay en Railway. Con varias habria que moverlo a un almacen
// compartido, o cada instancia llevaria su propia cuenta.
//
// Las cifras son generosas a proposito: en un pueblo muchos vecinos salen
// por la misma IP (la wifi de un bar, una operadora que comparte la IP entre
// miles de moviles), y un limite ajustado dejaria sin servicio a gente que
// no ha hecho nada. Sirven para cortar un bucle o un ataque, no para
// racionar el uso normal.
//
// El 429 sale con el mismo formato que el resto de errores ({ ok, mensaje })
// para que el cliente lo pinte como cualquier otro, y Retry-After /
// RateLimit-* en cabeceras para quien quiera saber cuanto esperar.

const crear = ({ minutos, max, mensaje, ...resto }) =>
  rateLimit({
    windowMs: minutos * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ ok: false, mensaje, razon: 'demasiadas_peticiones' });
    },
    ...resto,
  });

// Todo /api. El health check de Railway queda fuera: si contara, un
// monitor que lo consulta cada pocos segundos acabaria bloqueado.
export const limiteGeneral = crear({
  minutos: 15,
  max: 1000,
  mensaje: 'Demasiadas peticiones. Espera unos minutos e inténtalo de nuevo.',
  skip: (req) => req.path === '/health',
});

// Crear, reaccionar, comentar, mensajear...: todo lo que no es leer.
export const limiteEscrituras = crear({
  minutos: 15,
  max: 240,
  mensaje: 'Estás haciendo demasiadas acciones seguidas. Espera unos minutos.',
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
});

// Adivinar contrasenas o tokens. Solo cuentan los intentos que FALLAN: el
// vecino que entra bien no gasta cupo, y quien prueba claves se queda sin
// él a los diez.
export const limiteIntentosDeAcceso = crear({
  minutos: 15,
  max: 10,
  mensaje: 'Demasiados intentos. Espera unos minutos antes de volver a probar.',
  skipSuccessfulRequests: true,
});

// Registrarse y pedir un correo de recuperacion: acciones que cuestan algo
// (una cuenta, un email enviado) incluso cuando salen bien, asi que aqui
// cuentan todas. Complementa el freno por correo de recuperar contrasena.
export const limiteAltas = crear({
  minutos: 60,
  max: 10,
  mensaje: 'Has hecho demasiados intentos. Prueba de nuevo dentro de un rato.',
});

// Cada subida va a Cloudinary (cuota y ancho de banda propios).
export const limiteSubidas = crear({
  minutos: 60,
  max: 40,
  mensaje: 'Has subido muchas imágenes seguidas. Prueba de nuevo dentro de un rato.',
});
