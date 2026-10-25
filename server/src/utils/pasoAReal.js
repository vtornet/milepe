import Pago from '../models/Pago.js';
import Usuario from '../models/Usuario.js';
import NegocioDetalle from '../models/NegocioDetalle.js';
import EventoDetalle from '../models/EventoDetalle.js';
import { pagosActivos, esModoPrueba } from './stripe.js';

// Al pasar Stripe a cobros reales, lo que se "pagó" con tarjetas de prueba
// deja de valer: un negocio destacado, un evento patrocinado o un perfil
// verificado con la tarjeta 4242 no pueden seguir activos como si alguien
// hubiera pagado (decidido con el usuario, 2026-10-25).
//
// Se ejecuta al arrancar la API y solo con claves reales. Es idempotente y
// no toca nada que tenga ya un pago REAL detrás: si alguien pago de verdad
// por el mismo negocio (o por su verificacion), se respeta. La verificacion
// manual del admin (verificado_manual) no tiene que ver con pagos y no se toca.
// Los Pago de prueba se quedan en la base (el panel los separa).
export const retirarBeneficiosDePrueba = async () => {
  if (!pagosActivos() || esModoPrueba()) return null;

  const deVerdad = async (filtro) => Boolean(await Pago.exists({ ...filtro, modo_prueba: false, estado: 'pagado' }));
  const resumen = { negocios: 0, eventos: 0, verificaciones: 0 };
  const ahora = new Date();

  const pagosDePrueba = await Pago.find({ modo_prueba: true, estado: 'pagado' }).select('producto post_id usuario_id').lean();

  for (const postId of new Set(pagosDePrueba.filter((p) => p.producto === 'negocio_destacado').map((p) => String(p.post_id)))) {
    if (await deVerdad({ producto: 'negocio_destacado', post_id: postId })) continue;
    const r = await NegocioDetalle.updateOne({ post_id: postId, destacado_hasta: { $gt: ahora } }, { destacado_hasta: null });
    resumen.negocios += r.modifiedCount;
  }

  for (const postId of new Set(pagosDePrueba.filter((p) => p.producto === 'evento_patrocinado').map((p) => String(p.post_id)))) {
    if (await deVerdad({ producto: 'evento_patrocinado', post_id: postId })) continue;
    const r = await EventoDetalle.updateOne({ post_id: postId, patrocinado_hasta: { $gt: ahora } }, { patrocinado_hasta: null });
    resumen.eventos += r.modifiedCount;
  }

  for (const usuarioId of new Set(pagosDePrueba.filter((p) => p.producto === 'verificacion').map((p) => String(p.usuario_id)))) {
    if (await deVerdad({ producto: 'verificacion', usuario_id: usuarioId })) continue;
    const r = await Usuario.updateOne(
      { _id: usuarioId, verificado_hasta: { $ne: null } },
      {
        verificado_hasta: null,
        // La suscripcion de prueba no existe en modo real: fuera, para que
        // pueda suscribirse de verdad desde cero.
        'suscripcion.stripe_cliente_id': null,
        'suscripcion.stripe_suscripcion_id': null,
        'suscripcion.estado': null,
        'suscripcion.renovacion_cancelada': false,
        'suscripcion.fin_periodo': null,
        'suscripcion.modo_prueba': null,
      },
    );
    resumen.verificaciones += r.modifiedCount;
  }

  if (resumen.negocios || resumen.eventos || resumen.verificaciones) {
    console.log(
      `[pagos] Paso a cobros reales: retirados ${resumen.negocios} destacado(s), ${resumen.eventos} patrocinio(s) y ${resumen.verificaciones} verificacion(es) pagados en pruebas`,
    );
  }
  return resumen;
};
