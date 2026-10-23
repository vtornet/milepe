import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import routes from './routes/index.js';
import { sentryActivo, deberiaAvisar } from './instrument.js';
import { limiteGeneral, limiteEscrituras } from './middlewares/limites.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// En produccion la API esta detras del proxy de Railway: sin esto, req.ip
// seria siempre la direccion del proxy y los limites de peticiones
// contarian a todo el pueblo como una sola persona. El 1 es el numero de
// proxies de confianza (solo el de Railway): fiarse de mas dejaria que
// cualquiera se pusiera la IP que quisiera con una cabecera X-Forwarded-For
// inventada.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Cabeceras de seguridad. Esto es una API que solo responde JSON, asi que la
// politica de contenido puede ser la mas cerrada ('none': no carga nada).
// En desarrollo se quita porque el panel de pruebas (/panel) lleva scripts
// en linea que esa politica bloquearia. 'cross-origin' en los recursos
// porque el cliente (otro dominio) es quien los consume.
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production'
        ? { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }
        : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// CLIENT_URL admite varios origenes separados por comas, porque un dominio
// propio son al menos dos (milepe.com y www.milepe.com) y en desarrollo
// ademas esta localhost. Con un unico valor, como estaba antes, el www
// quedaba fuera y el navegador bloqueaba sus peticiones con un error de
// CORS que desde el cliente se ve como "no se pudo cargar", sin pista de
// por que.
const origenesPermitidos = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

// Una mala configuracion de CORS no se avisa peticion a peticion, se avisa
// una vez al arrancar: en los logs de produccion es lo primero que se ve, y
// no queda sepultada entre miles de lineas de trafico.
if (process.env.NODE_ENV === 'production' && origenesPermitidos.length === 0) {
  console.error(
    '[cors] CLIENT_URL no esta configurada. Ninguna peticion de navegador sera aceptada. ' +
      'Define CLIENT_URL con los origenes permitidos, separados por comas ' +
      '(ej. https://milepe.com,https://www.milepe.com).',
  );
}

app.use(
  cors({
    origin(origen, callback) {
      // Sin cabecera Origin son peticiones que no vienen de un navegador
      // (curl, el health check de Railway, una app movil): CORS no les
      // aplica y bloquearlas solo romperia la monitorizacion.
      if (!origen) return callback(null, true);

      // En desarrollo se permite cualquiera: el puerto de Vite cambia solo
      // si 5173 esta ocupado, y pelearse con CORS en local no aporta nada.
      if (origenesPermitidos.length === 0 && process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      // Permitido o no, pero nunca lanzando: un throw aqui acaba en el
      // gestor de errores y responde 500, que en los logs parece un fallo
      // del servidor cuando en realidad es una peticion rechazada a
      // proposito. Devolviendo false la respuesta sale sin las cabeceras
      // CORS, que es exactamente lo que el navegador necesita para
      // bloquearla.
      return callback(null, origenesPermitidos.includes(origen));
    },
    credentials: true,
  }),
);

app.use(
  morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    skip: () => process.env.NODE_ENV === 'test',
  }),
);

// Antes de leer el cuerpo de la peticion: rechazar una rafaga no debe
// costar ni parsear el JSON. Despues de CORS, para que el 429 lleve las
// cabeceras que el navegador necesita para dejar leerlo.
app.use('/api', limiteGeneral);
app.use('/api', limiteEscrituras);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// La raiz no es un endpoint real: existe solo para que quien abra
// http://localhost:5000/ en el navegador vea algo util en vez de un
// generico "Cannot GET /" y no piense que el servidor esta caido.
app.get('/', (req, res) => {
  res.json({ ok: true, mensaje: 'MiLepe API. Prueba /api/health o /api/quejas.' });
});

app.use('/api', routes);

// Panel HTML de pruebas manuales (registro/login/crear queja/listar), solo
// en desarrollo: pide y llama a /api con fetch() desde el propio origen, sin
// lios de CORS ni depender de Postman/curl. Nunca se sirve en produccion.
if (process.env.NODE_ENV !== 'production') {
  app.use('/panel', express.static(path.join(__dirname, '..', 'panel-pruebas')));
}

// Sentry, antes del manejador propio: este responde al cliente y no llama a
// next(), asi que lo que no pase por aqui antes no llega a Sentry. Solo se
// avisa de lo que de verdad es un fallo nuestro: lo que el manejador de
// abajo contesta como 4xx (validacion, duplicado, id mal formado, subida
// rechazada, ErrorHttp 404/403...) es el cliente equivocandose y llenaria
// el panel de ruido.
if (sentryActivo) {
  Sentry.setupExpressErrorHandler(app, { shouldHandleError: deberiaAvisar });
}

// Manejador de errores centralizado. Los controladores hacen next(error) y
// aqui se traduce a una respuesta JSON consistente. Ademas de ErrorHttp
// (que ya trae su status), traduce los dos errores de Mongoose mas
// habituales para que un fallo de validacion o un duplicado no salga como
// un 500 generico.
app.use((error, req, res, next) => {
  console.error(error);

  // Algunos errores traen un motivo legible por el cliente ademas del
  // mensaje (ver middlewares/perfil.js): dos 403 distintos llevan a dos
  // pantallas distintas, y adivinarlo del texto del mensaje seria fragil.
  const extra = error.razon ? { razon: error.razon } : {};

  if (error.name === 'ValidationError') {
    const mensaje = Object.values(error.errors)
      .map((e) => e.message)
      .join(', ');
    return res.status(400).json({ ok: false, mensaje, ...extra });
  }

  if (error.code === 11000) {
    const campo = Object.keys(error.keyValue || {})[0] || 'campo';
    return res.status(409).json({ ok: false, mensaje: `Ya existe un registro con ese ${campo}` });
  }

  // Un :id de la URL que no es un ObjectId valido (typo, id de otra
  // coleccion...) revienta como CastError, no como 404. Con rutas por :id
  // multiplicandose a partir de aqui (posts, quejas...), vale la pena
  // traducirlo aqui una sola vez.
  if (error.name === 'CastError' && error.kind === 'ObjectId') {
    return res.status(400).json({ ok: false, mensaje: 'Identificador no valido' });
  }

  // multer (subida de imagenes): archivo demasiado grande, demasiados
  // archivos, campo equivocado... Todos vienen con este name, sea cual sea
  // la ruta de subida que los dispare.
  if (error.name === 'MulterError') {
    return res.status(400).json({ ok: false, mensaje: `Error al subir el archivo: ${error.message}` });
  }

  const status = error.status || 500;
  res.status(status).json({
    ok: false,
    mensaje: error.message || 'Error interno del servidor',
    ...extra,
  });
});

export default app;
