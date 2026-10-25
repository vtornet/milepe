import 'dotenv/config';
// Sentry el primero tras dotenv (necesita SENTRY_DSN) y antes de cargar el resto.
import './instrument.js';
import app from './app.js';
import conectarDB from './config/db.js';
import { iniciarCronCaducarEmpleos } from './jobs/caducarEmpleos.js';
import { iniciarCronCopiaSeguridad } from './jobs/copiaSeguridad.js';
import { sincronizarAutobuses } from './utils/cargarAutobuses.js';
import Usuario from './models/Usuario.js';
import { retirarBeneficiosDePrueba } from './utils/pasoAReal.js';

const PORT = process.env.PORT || 5000;

const iniciar = async () => {
  await conectarDB();

  app.listen(PORT, () => {
    console.log(`[server] MiLepe API escuchando en el puerto ${PORT}`);
  });

  // Tareas programadas (node-cron). Se registran aqui, despues de
  // confirmar la conexion a Mongo, no al importar el modulo.
  iniciarCronCaducarEmpleos();
  iniciarCronCopiaSeguridad();
  // Sin await: no retrasa que la API empiece a escuchar, y nunca lanza.
  sincronizarAutobuses();
  // Los admin llevan siempre la insignia de verificado.
  Usuario.asegurarVerificacionDeAdmins().catch((error) => console.error('[usuarios]', error.message));
  // Con claves reales, lo pagado con tarjetas de prueba deja de valer.
  retirarBeneficiosDePrueba().catch((error) => console.error('[pagos]', error.message));
};

iniciar().catch((error) => {
  console.error('[server] No se pudo arrancar la aplicacion:', error);
  process.exit(1);
});
