import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes/index.js';

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

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

  const status = error.status || 500;
  res.status(status).json({
    ok: false,
    mensaje: error.message || 'Error interno del servidor',
  });
});

export default app;
