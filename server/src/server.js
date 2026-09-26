import 'dotenv/config';
import app from './app.js';
import conectarDB from './config/db.js';
import { iniciarCronCaducarEmpleos } from './jobs/caducarEmpleos.js';

const PORT = process.env.PORT || 5000;

const iniciar = async () => {
  await conectarDB();

  app.listen(PORT, () => {
    console.log(`[server] MiLepe API escuchando en el puerto ${PORT}`);
  });

  // Tareas programadas (node-cron). Se registran aqui, despues de
  // confirmar la conexion a Mongo, no al importar el modulo.
  iniciarCronCaducarEmpleos();
};

iniciar().catch((error) => {
  console.error('[server] No se pudo arrancar la aplicacion:', error);
  process.exit(1);
});
