import Usuario from '../models/Usuario.js';
import Pago from '../models/Pago.js';
import Notificacion from '../models/Notificacion.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { PRODUCTOS, pagosActivos, stripe, esModoPrueba } from '../utils/stripe.js';

// Perfil verificado: suscripcion de Stripe a 1 EUR/mes (ver
// PRODUCTOS.verificacion) o, sin pagar, concedido por un admin.
//
// Lo que manda es Usuario.verificado_hasta: cada factura pagada lo lleva al
// final de su periodo. Darse de baja solo apaga la renovacion
// (cancel_at_period_end), asi que la insignia dura hasta el final del mes ya
// pagado sin que nadie tenga que acordarse de quitarla.

const sitio = () => (process.env.SITIO_URL || 'https://milepe.com').replace(/\/$/, '');
const desdeUnix = (segundos) => (segundos ? new Date(segundos * 1000) : null);

const estadoPara = (usuario) => ({
  verificado: usuario.estaVerificado(),
  manual: Boolean(usuario.verificado_manual),
  hasta: usuario.verificado_hasta,
  suscripcion: {
    estado: usuario.suscripcion?.estado || null,
    renovacion_cancelada: Boolean(usuario.suscripcion?.renovacion_cancelada),
    fin_periodo: usuario.suscripcion?.fin_periodo || null,
  },
  precio: PRODUCTOS.verificacion.importe(),
  pagos_activos: pagosActivos(),
});

export const miVerificacion = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id);
    res.json({ ok: true, ...estadoPara(usuario) });
  } catch (error) {
    next(error);
  }
};

// Abre Stripe Checkout en modo suscripcion.
export const suscribirse = async (req, res, next) => {
  try {
    if (!pagosActivos()) throw new ErrorHttp(503, 'Los pagos no están disponibles ahora mismo');
    const usuario = await Usuario.findById(req.usuario._id);
    if (usuario.verificado_manual) throw new ErrorHttp(409, 'Tu perfil ya está verificado por el equipo de MiLepe: no tienes que pagar');
    const s = usuario.suscripcion || {};
    if (s.estado === 'activa' || s.estado === 'impagada') {
      throw new ErrorHttp(
        409,
        s.renovacion_cancelada
          ? 'Ya tienes la suscripción; está dada de baja y puedes reactivarla desde tu perfil'
          : 'Ya tienes la suscripción activa',
      );
    }

    const sesion = await stripe().checkout.sessions.create({
      mode: 'subscription',
      locale: 'es',
      ...(s.stripe_cliente_id ? { customer: s.stripe_cliente_id } : { customer_email: usuario.email }),
      client_reference_id: String(usuario._id),
      metadata: { usuario_id: String(usuario._id), producto: 'verificacion' },
      // La suscripcion lleva el usuario en sus metadatos: es como se sabe de
      // quien es cada factura mensual, que llega sin la sesion de Checkout.
      subscription_data: { metadata: { usuario_id: String(usuario._id), producto: 'verificacion' } },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: PRODUCTOS.verificacion.importe(),
            recurring: { interval: 'month' },
            product_data: { name: PRODUCTOS.verificacion.nombre, description: `Insignia de perfil verificado para ${usuario.nombre_usuario}` },
          },
        },
      ],
      success_url: `${sitio()}/pagos/resultado?verificacion=1`,
      cancel_url: `${sitio()}/pagos/resultado?verificacion=1&cancelado=1`,
    });
    res.status(201).json({ ok: true, url: sesion.url });
  } catch (error) {
    next(error);
  }
};

// Baja (o vuelta atras de la baja): solo cambia si se renueva al final del
// periodo. Lo pagado se respeta siempre.
const cambiarRenovacion = (cancelar) => async (req, res, next) => {
  try {
    if (!pagosActivos()) throw new ErrorHttp(503, 'Los pagos no están disponibles ahora mismo');
    const usuario = await Usuario.findById(req.usuario._id);
    const id = usuario.suscripcion?.stripe_suscripcion_id;
    if (!id || !['activa', 'impagada'].includes(usuario.suscripcion.estado)) {
      throw new ErrorHttp(409, 'No tienes ninguna suscripción en curso');
    }
    await stripe().subscriptions.update(id, { cancel_at_period_end: cancelar });
    // El aviso de Stripe lo confirmara; se anota ya para que la pantalla
    // no diga lo contrario de lo que se acaba de pedir.
    usuario.suscripcion.renovacion_cancelada = cancelar;
    await usuario.save();
    res.json({ ok: true, ...estadoPara(usuario) });
  } catch (error) {
    next(error);
  }
};
export const darseDeBaja = cambiarRenovacion(true);
export const reactivar = cambiarRenovacion(false);

// Verificacion sin pagar, por un admin. A un admin no se le quita: los admin
// estan siempre verificados.
export const marcarVerificado = async (req, res, next) => {
  try {
    const { verificado } = req.body || {};
    if (typeof verificado !== 'boolean') throw new ErrorHttp(400, 'verificado debe ser true o false');
    const usuario = await Usuario.findOne({ _id: req.params.id, activo: true });
    if (!usuario) throw new ErrorHttp(404, 'Usuario no encontrado');
    if (!verificado && usuario.rol === 'admin') throw new ErrorHttp(409, 'Los administradores están siempre verificados');

    if (usuario.verificado_manual !== verificado) {
      usuario.verificado_manual = verificado;
      await usuario.save();
      await Notificacion.create({
        usuario_id: usuario._id,
        tipo: 'verificacion',
        mensaje: verificado
          ? 'El equipo de MiLepe ha verificado tu perfil: ya llevas la insignia.'
          : 'El equipo de MiLepe ha retirado la verificación de tu perfil.',
        referencia_id: usuario._id,
        referencia_tipo: 'usuario',
      });
    }
    res.json({
      ok: true,
      usuario: {
        _id: usuario._id,
        verificado_manual: usuario.verificado_manual,
        verificado_hasta: usuario.verificado_hasta,
        verificado: usuario.estaVerificado(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// --- Avisos de Stripe (los llama webhookStripe) ---

// De quien es: por los metadatos que se pusieron en la suscripcion o, si no
// vienen, por el cliente de Stripe ya guardado.
const usuarioDe = async ({ metadatos, cliente }) => {
  if (metadatos?.usuario_id && /^[a-f0-9]{24}$/i.test(metadatos.usuario_id)) {
    const u = await Usuario.findById(metadatos.usuario_id);
    if (u) return u;
  }
  return cliente ? Usuario.findOne({ 'suscripcion.stripe_cliente_id': cliente }) : null;
};

// Las facturas cambiaron de forma en la API "basil" de Stripe (2025): la
// suscripcion y sus metadatos pasaron a invoice.parent.subscription_details.
// Se leen las dos formas.
const datosFactura = (factura) => {
  const detalles = factura.parent?.subscription_details || factura.subscription_details || {};
  const linea = factura.lines?.data?.[0];
  return {
    suscripcion: detalles.subscription || factura.subscription || null,
    metadatos: detalles.metadata || linea?.metadata || {},
    finPeriodo: desdeUnix(linea?.period?.end || factura.period_end),
  };
};

const ESTADO_STRIPE = { active: 'activa', trialing: 'activa', past_due: 'impagada', unpaid: 'impagada', canceled: 'cancelada', incomplete_expired: 'cancelada' };

export const procesarEventoVerificacion = async (evento) => {
  const objeto = evento.data?.object || {};

  if (evento.type === 'checkout.session.completed' && objeto.mode === 'subscription') {
    const usuario = await usuarioDe({ metadatos: objeto.metadata, cliente: objeto.customer });
    if (!usuario) return false;
    usuario.suscripcion.stripe_cliente_id = objeto.customer || usuario.suscripcion.stripe_cliente_id;
    usuario.suscripcion.stripe_suscripcion_id = objeto.subscription || usuario.suscripcion.stripe_suscripcion_id;
    if (!usuario.suscripcion.estado || usuario.suscripcion.estado === 'cancelada') usuario.suscripcion.estado = 'activa';
    usuario.suscripcion.renovacion_cancelada = false;
    await usuario.save();
    return true;
  }

  if (evento.type === 'invoice.paid') {
    const { suscripcion, metadatos, finPeriodo } = datosFactura(objeto);
    if (metadatos.producto && metadatos.producto !== 'verificacion') return false;
    const usuario = await usuarioDe({ metadatos, cliente: objeto.customer });
    if (!usuario || !finPeriodo) return false;

    // Una factura, un registro: si el aviso llega repetido, el indice unico
    // de stripe_factura_id lo para y no se vuelve a aplicar.
    try {
      await Pago.create({
        usuario_id: usuario._id,
        producto: 'verificacion',
        importe: objeto.amount_paid ?? PRODUCTOS.verificacion.importe(),
        dias: Math.max(1, Math.round((finPeriodo - Date.now()) / 86400000)),
        estado: 'pagado',
        stripe_factura_id: objeto.id,
        modo_prueba: esModoPrueba(),
        vigente_hasta: finPeriodo,
        pagado_en: new Date(),
      });
    } catch (error) {
      if (error.code === 11000) return false;
      throw error;
    }

    const yaVerificado = usuario.estaVerificado();
    if (!usuario.verificado_hasta || finPeriodo > usuario.verificado_hasta) usuario.verificado_hasta = finPeriodo;
    usuario.suscripcion.stripe_cliente_id = objeto.customer || usuario.suscripcion.stripe_cliente_id;
    usuario.suscripcion.stripe_suscripcion_id = suscripcion || usuario.suscripcion.stripe_suscripcion_id;
    usuario.suscripcion.estado = 'activa';
    usuario.suscripcion.fin_periodo = finPeriodo;
    await usuario.save();
    if (!yaVerificado) {
      await Notificacion.create({
        usuario_id: usuario._id,
        tipo: 'verificacion',
        mensaje: 'Tu perfil ya está verificado: llevas la insignia junto a tu nombre.',
        referencia_id: usuario._id,
        referencia_tipo: 'usuario',
      });
    }
    return true;
  }

  if (evento.type === 'invoice.payment_failed') {
    const { metadatos } = datosFactura(objeto);
    const usuario = await usuarioDe({ metadatos, cliente: objeto.customer });
    if (!usuario) return false;
    // Stripe reintenta el cobro unos dias; mientras, la insignia sigue hasta
    // el final de lo ya pagado.
    usuario.suscripcion.estado = 'impagada';
    await usuario.save();
    return true;
  }

  if (evento.type === 'customer.subscription.updated' || evento.type === 'customer.subscription.deleted') {
    if (objeto.metadata?.producto && objeto.metadata.producto !== 'verificacion') return false;
    const usuario = await usuarioDe({ metadatos: objeto.metadata, cliente: objeto.customer });
    if (!usuario) return false;
    usuario.suscripcion.stripe_suscripcion_id = objeto.id || usuario.suscripcion.stripe_suscripcion_id;
    usuario.suscripcion.estado = evento.type === 'customer.subscription.deleted' ? 'cancelada' : ESTADO_STRIPE[objeto.status] || usuario.suscripcion.estado;
    usuario.suscripcion.renovacion_cancelada = evento.type === 'customer.subscription.deleted' || Boolean(objeto.cancel_at_period_end);
    // En "basil" el periodo vive en cada elemento de la suscripcion.
    const fin = desdeUnix(objeto.items?.data?.[0]?.current_period_end || objeto.current_period_end);
    if (fin) usuario.suscripcion.fin_periodo = fin;
    await usuario.save();
    return true;
  }

  return false;
};

// Al borrar la cuenta: la suscripcion se cancela ya (no tiene sentido seguir
// cobrando a una cuenta que no existe). Si Stripe falla, no para el borrado.
export const cancelarSuscripcionAlBorrar = async (usuario) => {
  const id = usuario.suscripcion?.stripe_suscripcion_id;
  if (!id || !pagosActivos() || usuario.suscripcion.estado === 'cancelada') return;
  try {
    await stripe().subscriptions.cancel(id);
  } catch (error) {
    console.error('[pagos] No se pudo cancelar la suscripcion al borrar la cuenta:', error.message);
  }
};
