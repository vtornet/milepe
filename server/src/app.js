import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
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

  if (error.name === 'ValidationError') {
    const mensaje = Object.values(error.errors)
      .map((e) => e.message)
      .join(', ');
    return res.status(400).json({ ok: false, mensaje });
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

  const status = error.status || 500;
  res.status(status).json({
    ok: false,
    mensaje: error.message || 'Error interno del servidor',
  });
});

export default app;
