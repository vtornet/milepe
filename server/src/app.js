import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

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

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
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
