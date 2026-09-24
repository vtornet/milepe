import 'dotenv/config';
import app from './app.js';
import conectarDB from './config/db.js';

const PORT = process.env.PORT || 5000;

const iniciar = async () => {
  await conectarDB();

  app.listen(PORT, () => {
    console.log(`[server] MiLepe API escuchando en el puerto ${PORT}`);
  });

  // Aqui se registran las tareas programadas (node-cron), por ejemplo
  // la caducidad automatica de ofertas de empleo:
  // import './jobs/caducarEmpleos.js';
};

iniciar().catch((error) => {
  console.error('[server] No se pudo arrancar la aplicacion:', error);
  process.exit(1);
});
