import cron from 'node-cron';
import { hacerCopia, hayCredencialesCloudinary } from '../utils/copiaSeguridad.js';

// Cada dia a las 04:00 (despues del cron de empleos de las 03:00): vuelca
// la base entera, la sube a Cloudinary como fichero privado y deja solo las
// ultimas copias (ver utils/copiaSeguridad.js).
//
// Solo en produccion. En local, MONGODB_URI apunta por el tunel a la base
// de PRODUCCION (ver CLAUDE.md "Despliegue"): dejar que `npm run dev`
// hiciera copias seria subir la base real desde un portatil, cada noche
// que estuviera encendido, para duplicar la que ya hace Railway.
export const iniciarCronCopiaSeguridad = () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[cron] Copias de seguridad desactivadas (solo se programan en produccion)');
    return;
  }

  if (!hayCredencialesCloudinary()) {
    console.error('[cron] Copias de seguridad NO programadas: faltan las credenciales de Cloudinary');
    return;
  }

  cron.schedule('0 4 * * *', async () => {
    try {
      const copia = await hacerCopia();
      const documentos = Object.values(copia.colecciones).reduce((a, b) => a + b, 0);
      console.log(
        `[cron] Copia de seguridad ${copia.id}: ${documentos} documentos, ${copia.bytes} bytes, ${copia.borradas} antigua(s) borrada(s)`,
      );
    } catch (error) {
      // Un fallo aqui no tira el servidor, pero tiene que verse en los
      // logs: una copia que falla en silencio es peor que no tenerla.
      console.error('[cron] ERROR en la copia de seguridad:', error);
    }
  });

  console.log('[cron] Copia de seguridad de MongoDB programada (diario, 04:00)');
};
