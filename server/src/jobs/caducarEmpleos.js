import cron from 'node-cron';
import EmpleoDetalle from '../models/EmpleoDetalle.js';

// Cada dia a las 03:00: busca ofertas de empleo ('ofrezco') activas cuya
// fecha_caducidad ya paso y las marca como caducadas. No las borra ni
// toca el Post: EmpleoDetalle.marcarCaducada() ya existe para esto (ver
// server/src/models/EmpleoDetalle.js), aqui solo se decide cuando se
// llama. 'busco' no tiene caducidad, asi que nunca entra en este filtro.
export const iniciarCronCaducarEmpleos = () => {
  cron.schedule('0 3 * * *', async () => {
    try {
      const vencidas = await EmpleoDetalle.find({
        modalidad: 'ofrezco',
        estado_oferta: 'activa',
        fecha_caducidad: { $lte: new Date() },
      });

      for (const oferta of vencidas) {
        oferta.marcarCaducada();
        await oferta.save();
      }

      console.log(`[cron] ${vencidas.length} oferta(s) de empleo caducada(s)`);
    } catch (error) {
      console.error('[cron] Error al caducar ofertas de empleo:', error);
    }
  });

  console.log('[cron] Caducidad de ofertas de empleo programada (diario, 03:00)');
};
