import Pago from '../models/Pago.js';
import Usuario from '../models/Usuario.js';
import NegocioDetalle from '../models/NegocioDetalle.js';
import EventoDetalle from '../models/EventoDetalle.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { PRODUCTOS, pagosActivos, stripe, esModoPrueba } from '../utils/stripe.js';
import { cargarNegocio, puedeGestionar } from './negociosController.js';
import { cargarEvento } from './eventosController.js';

const DIA_MS = 24 * 60 * 60 * 1000;
const sitio = () => (process.env.SITIO_URL || 'https://milepe.com').replace(/\/$/, '');

// Lo que el cliente necesita para ensenar (o no) los botones de pagar.
export const configuracionPagos = (req, res) => {
  res.json({
    ok: true,
    activo: pagosActivos(),
    modo_prueba: pagosActivos() && esModoPrueba(),
    productos: Object.fromEntries(
      Object.entries(PRODUCTOS).map(([clave, p]) => [clave, { nombre: p.nombre, importe: p.importe(), dias: p.dias }]),
    ),
  });
};

// Comprueba que quien paga puede destacar ESO, y cuantos dias le tocan.
// Un negocio lo destaca quien lo gestiona (admin, propietario o, sin
// propietario, quien lo publico); un evento, quien lo publico o un admin.
const prepararCompra = async (producto, postId, usuario) => {
  if (producto === 'negocio_destacado') {
    const { post, detalle } = await cargarNegocio(postId);
    if (!puedeGestionar(usuario, post, detalle)) throw new ErrorHttp(403, 'Solo quien gestiona el negocio puede destacarlo');
    return { post, dias: PRODUCTOS.negocio_destacado.dias };
  }
  if (producto === 'evento_patrocinado') {
    const { post, detalle } = await cargarEvento(postId);
    if (usuario.rol !== 'admin' && !post.autor_id.equals(usuario._id)) {
      throw new ErrorHttp(403, 'Solo quien publicó el evento puede patrocinarlo');
    }
    // Patrocinado hasta que termine (o empiece, si no tiene fin), con un
    // maximo: no tiene sentido cobrar dias en que el evento ya paso.
    const fin = detalle.fecha_fin || detalle.fecha_inicio;
    const diasHastaElFin = Math.ceil((fin.getTime() - Date.now()) / DIA_MS);
    if (diasHastaElFin < 1) throw new ErrorHttp(400, 'Este evento ya ha pasado');
    return { post, dias: Math.min(PRODUCTOS.evento_patrocinado.dias, diasHastaElFin) };
  }
  throw new ErrorHttp(400, `producto debe ser uno de: ${Object.keys(PRODUCTOS).join(', ')}`);
};

// Abre una sesion de Stripe Checkout y devuelve su URL. El navegador va a
// Stripe a pagar; la confirmacion llega por el webhook, no por la vuelta.
export const crearCheckout = async (req, res, next) => {
  let pago;
  try {
    if (!pagosActivos()) throw new ErrorHttp(503, 'Los pagos no están disponibles ahora mismo');
    const { producto, post_id: postId } = req.body || {};
    const { post, dias } = await prepararCompra(producto, postId, req.usuario);
    const importe = PRODUCTOS[producto].importe();

    pago = await Pago.create({
      usuario_id: req.usuario._id,
      producto,
      post_id: post._id,
      importe,
      dias,
      modo_prueba: esModoPrueba(),
    });

    const usuario = await Usuario.findById(req.usuario._id).select('email');
    const sesion = await stripe().checkout.sessions.create({
      mode: 'payment',
      locale: 'es',
      customer_email: usuario?.email,
      client_reference_id: String(pago._id),
      metadata: { pago_id: String(pago._id), producto, post_id: String(post._id) },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: importe,
            product_data: {
              name: PRODUCTOS[producto].nombre,
              description: `${post.titulo} · ${dias} día${dias === 1 ? '' : 's'}`,
            },
          },
        },
      ],
      success_url: `${sitio()}/pagos/resultado?pago=${pago._id}`,
      cancel_url: `${sitio()}/pagos/resultado?pago=${pago._id}&cancelado=1`,
    });

    pago.stripe_sesion_id = sesion.id;
    await pago.save();
    res.status(201).json({ ok: true, url: sesion.url, pago_id: pago._id });
  } catch (error) {
    // Un pago que no llego a tener sesion no sirve para nada.
    if (pago && !pago.stripe_sesion_id) await Pago.deleteOne({ _id: pago._id });
    next(error);
  }
};

// Da lo pagado. Idempotente: Stripe puede mandar el mismo evento varias
// veces, y solo la primera encuentra el pago en 'pendiente'.
export const aplicarPago = async (pagoId, { stripePagoId = null } = {}) => {
  const pago = await Pago.findOneAndUpdate(
    { _id: pagoId, estado: 'pendiente' },
    { $set: { estado: 'pagado', pagado_en: new Date(), stripe_pago_id: stripePagoId } },
    { new: true },
  );
  if (!pago) return null;

  let vigenteHasta = null;
  if (pago.producto === 'negocio_destacado') {
    const detalle = await NegocioDetalle.findOne({ post_id: pago.post_id });
    if (detalle) {
      detalle.extenderDestacado(pago.dias);
      await detalle.save();
      vigenteHasta = detalle.destacado_hasta;
    }
  } else if (pago.producto === 'evento_patrocinado') {
    const detalle = await EventoDetalle.findOne({ post_id: pago.post_id });
    if (detalle) {
      // Mismo criterio que extenderDestacado: si sigue patrocinado, se suma
      // a lo que le queda; si no, desde ahora.
      const base = detalle.estaPatrocinado() ? detalle.patrocinado_hasta : new Date();
      detalle.patrocinado_hasta = new Date(base.getTime() + pago.dias * DIA_MS);
      await detalle.save();
      vigenteHasta = detalle.patrocinado_hasta;
    }
  }
  pago.vigente_hasta = vigenteHasta;
  await pago.save();
  return pago;
};

// Webhook de Stripe. Va montado en app.js ANTES de express.json y de los
// limites: la firma se comprueba sobre el cuerpo crudo, byte a byte, y un
// limite de peticiones podria tirar avisos de pagos reales.
export const webhookStripe = async (req, res) => {
  const secreto = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!pagosActivos() || !secreto) return res.status(503).json({ ok: false, mensaje: 'Pagos sin configurar' });

  let evento;
  try {
    evento = stripe().webhooks.constructEvent(req.body, req.headers['stripe-signature'], secreto);
  } catch (error) {
    console.error('[pagos] Webhook con firma no valida:', error.message);
    return res.status(400).json({ ok: false, mensaje: 'Firma no válida' });
  }

  try {
    const sesion = evento.data?.object;
    const pagoId = sesion?.metadata?.pago_id || sesion?.client_reference_id;
    if (pagoId && /^[a-f0-9]{24}$/i.test(pagoId)) {
      if (
        (evento.type === 'checkout.session.completed' && sesion.payment_status === 'paid') ||
        evento.type === 'checkout.session.async_payment_succeeded'
      ) {
        await aplicarPago(pagoId, { stripePagoId: sesion.payment_intent || null });
      } else if (evento.type === 'checkout.session.expired') {
        await Pago.updateOne({ _id: pagoId, estado: 'pendiente' }, { estado: 'caducado' });
      } else if (evento.type === 'checkout.session.async_payment_failed') {
        await Pago.updateOne({ _id: pagoId, estado: 'pendiente' }, { estado: 'fallido' });
      }
    }
    // 200 siempre que la firma sea buena: si no, Stripe reintenta durante
    // dias un evento que ya hemos visto o que no nos interesa.
    res.json({ ok: true, recibido: true });
  } catch (error) {
    // Aqui si interesa que Stripe reintente: algo fallo de nuestro lado.
    console.error('[pagos] Error aplicando el webhook:', error.message);
    res.status(500).json({ ok: false });
  }
};

// Estado de un pago propio, para la pantalla de vuelta de Stripe (que espera
// a que llegue el webhook, normalmente unos segundos).
export const obtenerPago = async (req, res, next) => {
  try {
    const pago = await Pago.findOne({ _id: req.params.id, usuario_id: req.usuario._id }).populate('post_id', 'titulo tipo');
    if (!pago) throw new ErrorHttp(404, 'Pago no encontrado');
    res.json({ ok: true, pago });
  } catch (error) {
    next(error);
  }
};

export const listarMisPagos = async (req, res, next) => {
  try {
    const pagos = await Pago.find({ usuario_id: req.usuario._id }).sort({ fecha_creacion: -1 }).limit(100).populate('post_id', 'titulo tipo');
    res.json({ ok: true, pagos });
  } catch (error) {
    next(error);
  }
};

// --- Panel del admin ---

const ZONA = 'Europe/Madrid';
const TOPE_LISTADO = 200;

// Los cobros de toda la red, con un resumen: lo cobrado (solo lo pagado) este
// mes y en total, y cuantos hay en cada estado. Los de prueba y los reales se
// cuentan aparte: mezclar 9,90 EUR de tarjetas ficticias con ingresos de
// verdad haria el numero inutil. ?estado= y ?modo=prueba|real filtran la
// lista; el resumen es siempre del modo pedido.
export const listarPagosAdmin = async (req, res, next) => {
  try {
    const modo = req.query.modo === 'real' ? 'real' : req.query.modo === 'prueba' ? 'prueba' : null;
    const filtroModo = modo ? { modo_prueba: modo === 'prueba' } : {};
    const filtro = { ...filtroModo };
    if (req.query.estado) {
      if (!['pendiente', 'pagado', 'caducado', 'fallido'].includes(req.query.estado)) {
        throw new ErrorHttp(400, 'estado debe ser pendiente, pagado, caducado o fallido');
      }
      filtro.estado = req.query.estado;
    }

    // Primer instante del mes en curso en Madrid (no en UTC: el dia 1 a las
    // 00:30 de Lepe todavia es el mes anterior en UTC).
    const mes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit' }).format(new Date());

    const [pagos, porEstado, ingresos] = await Promise.all([
      Pago.find(filtro)
        .sort({ fecha_creacion: -1 })
        .limit(TOPE_LISTADO)
        .populate('usuario_id', 'nombre_usuario')
        .populate('post_id', 'titulo tipo')
        .lean(),
      Pago.aggregate([{ $match: filtroModo }, { $group: { _id: '$estado', n: { $sum: 1 } } }]),
      Pago.aggregate([
        { $match: { ...filtroModo, estado: 'pagado' } },
        {
          $group: {
            _id: null,
            total: { $sum: '$importe' },
            n: { $sum: 1 },
            mes: {
              $sum: {
                $cond: [{ $eq: [{ $dateToString: { format: '%Y-%m', date: '$pagado_en', timezone: ZONA } }, mes] }, '$importe', 0],
              },
            },
            n_mes: {
              $sum: { $cond: [{ $eq: [{ $dateToString: { format: '%Y-%m', date: '$pagado_en', timezone: ZONA } }, mes] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const i = ingresos[0] || { total: 0, n: 0, mes: 0, n_mes: 0 };
    res.json({
      ok: true,
      modo: modo || 'todos',
      mes,
      resumen: {
        cobrado_mes: i.mes,
        pagos_mes: i.n_mes,
        cobrado_total: i.total,
        pagos_total: i.n,
        por_estado: Object.fromEntries(porEstado.map((e) => [e._id, e.n])),
      },
      pagos,
    });
  } catch (error) {
    next(error);
  }
};
