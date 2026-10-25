import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { arrancar } from './ayuda.js';

// Claves de prueba inventadas: el webhook se firma y se comprueba con la
// libreria real de Stripe (no necesita red); solo la creacion de la sesion de
// Checkout, que si iria a Stripe, se sustituye.
const SECRETO_WEBHOOK = 'whsec_prueba_milepe';
process.env.STRIPE_SECRET_KEY = 'sk_test_prueba_milepe';
process.env.STRIPE_WEBHOOK_SECRET = SECRETO_WEBHOOK;

const firmador = new Stripe('sk_test_prueba_milepe');
const sesionesCreadas = [];

let t;
let duena;
let otro;
let negocioId;
let eventoId;
let eventoPasadoId;

before(async () => {
  t = await arrancar();
  const { usarClienteStripe } = await import('../src/utils/stripe.js');
  usarClienteStripe({
    checkout: {
      sessions: {
        create: async (datos) => {
          const sesion = { id: `cs_test_${sesionesCreadas.length + 1}`, url: `https://checkout.stripe.com/c/pay/${sesionesCreadas.length + 1}` };
          sesionesCreadas.push({ ...datos, id: sesion.id });
          return sesion;
        },
      },
    },
    webhooks: firmador.webhooks,
  });

  duena = await t.crearUsuario();
  otro = await t.crearUsuario();
  negocioId = (
    await t.api.post(
      '/negocios',
      { titulo: 'Bar La Plaza', contenido: 'Tapas', categoria: 'restauracion', direccion: 'Plaza', ubicacion: { lat: 37.25, lng: -7.2 } },
      { token: duena.token },
    )
  ).body.negocio._id;
  const evento = (dias, titulo) =>
    t.api.post(
      '/eventos',
      { titulo, contenido: 'x', categoria: 'concierto', lugar: 'Plaza', fecha_inicio: new Date(Date.now() + dias * 86400000).toISOString() },
      { token: duena.token },
    );
  eventoId = (await evento(10, 'Concierto')).body.evento._id;
  eventoPasadoId = (await evento(2, 'Pasado')).body.evento._id;
  const { default: EventoDetalle } = await import('../src/models/EventoDetalle.js');
  await EventoDetalle.updateOne({ post_id: eventoPasadoId }, { fecha_inicio: new Date(Date.now() - 86400000) });
});
after(() => t.detener());

const comprar = (quien, producto, postId) => t.api.post('/pagos/checkout', { producto, post_id: postId }, { token: quien.token });

// Envia al webhook un evento firmado como lo firmaria Stripe.
const webhook = async (evento, { secreto = SECRETO_WEBHOOK } = {}) => {
  const cuerpo = JSON.stringify(evento);
  const firma = firmador.webhooks.generateTestHeaderString({ payload: cuerpo, secret: secreto });
  const r = await fetch(`${t.base}/pagos/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': firma },
    body: cuerpo,
  });
  return r.status;
};
const completado = (pagoId) => ({
  id: `evt_${Math.random()}`,
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_x', payment_status: 'paid', payment_intent: 'pi_123', metadata: { pago_id: pagoId } } },
});

test('config pública: precios y modo de prueba', async () => {
  const r = await t.api.get('/pagos/config');
  assert.equal(r.body.activo, true);
  assert.equal(r.body.modo_prueba, true);
  assert.equal(r.body.productos.negocio_destacado.importe, 990);
  assert.equal(r.body.productos.evento_patrocinado.importe, 490);
});

test('solo quien gestiona el negocio puede pagar su destacado; la sesión lleva el precio y la vuelta', async () => {
  assert.equal((await comprar(otro, 'negocio_destacado', negocioId)).status, 403);
  assert.equal((await comprar(duena, 'cosa_rara', negocioId)).status, 400);

  const r = await comprar(duena, 'negocio_destacado', negocioId);
  assert.equal(r.status, 201);
  assert.match(r.body.url, /^https:\/\/checkout\.stripe\.com\//);
  const sesion = sesionesCreadas.at(-1);
  assert.equal(sesion.mode, 'payment');
  assert.equal(sesion.line_items[0].price_data.unit_amount, 990);
  assert.equal(sesion.line_items[0].price_data.currency, 'eur');
  assert.equal(sesion.metadata.pago_id, r.body.pago_id);
  assert.match(sesion.success_url, new RegExp(`/pagos/resultado\\?pago=${r.body.pago_id}$`));
});

test('el webhook firmado aplica el pago una sola vez aunque llegue repetido', async () => {
  const { body } = await comprar(duena, 'negocio_destacado', negocioId);
  assert.equal(await webhook(completado(body.pago_id)), 200);
  assert.equal(await webhook(completado(body.pago_id)), 200, 'Stripe reintenta: se contesta bien');

  const pago = (await t.api.get(`/pagos/${body.pago_id}`, { token: duena.token })).body.pago;
  assert.equal(pago.estado, 'pagado');
  const dias = (new Date(pago.vigente_hasta) - Date.now()) / 86400000;
  assert.ok(dias > 29 && dias <= 30, `30 días, no 60 (${dias})`);

  const negocio = (await t.api.get('/negocios')).body.negocios.find((n) => n._id === negocioId);
  assert.equal(negocio.destacado, true);

  // Un segundo pago se suma a lo que queda.
  const segundo = (await comprar(duena, 'negocio_destacado', negocioId)).body;
  await webhook(completado(segundo.pago_id));
  const p2 = (await t.api.get(`/pagos/${segundo.pago_id}`, { token: duena.token })).body.pago;
  assert.ok((new Date(p2.vigente_hasta) - Date.now()) / 86400000 > 59);
});

test('un webhook con firma falsa o sin firma no aplica nada', async () => {
  const { body } = await comprar(duena, 'negocio_destacado', negocioId);
  assert.equal(await webhook(completado(body.pago_id), { secreto: 'whsec_otro' }), 400);
  const r = await fetch(`${t.base}/pagos/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(completado(body.pago_id)) });
  assert.equal(r.status, 400);
  assert.equal((await t.api.get(`/pagos/${body.pago_id}`, { token: duena.token })).body.pago.estado, 'pendiente');

  await webhook({ id: 'evt_c', type: 'checkout.session.expired', data: { object: { metadata: { pago_id: body.pago_id } } } });
  assert.equal((await t.api.get(`/pagos/${body.pago_id}`, { token: duena.token })).body.pago.estado, 'caducado');
});

test('evento: solo su autor, hasta su fecha, y sale primero en la agenda', async () => {
  assert.equal((await comprar(otro, 'evento_patrocinado', eventoId)).status, 403);
  assert.equal((await comprar(duena, 'evento_patrocinado', eventoPasadoId)).status, 400);

  const { body } = await comprar(duena, 'evento_patrocinado', eventoId);
  assert.equal(sesionesCreadas.at(-1).line_items[0].price_data.unit_amount, 490);
  await webhook(completado(body.pago_id));
  const pago = (await t.api.get(`/pagos/${body.pago_id}`, { token: duena.token })).body.pago;
  assert.equal(pago.dias, 10, 'hasta el evento, no 30 días');

  await t.api.post(
    '/eventos',
    { titulo: 'Antes', contenido: 'x', categoria: 'concierto', lugar: 'Plaza', fecha_inicio: new Date(Date.now() + 2 * 86400000).toISOString() },
    { token: otro.token },
  );
  const agenda = (await t.api.get('/eventos')).body.eventos;
  assert.equal(agenda[0]._id, eventoId, 'el patrocinado primero aunque haya otro antes');
  assert.equal(agenda[0].patrocinado, true);
});

test('cada uno ve solo sus pagos; aparecen en la descarga de datos', async () => {
  assert.equal((await t.api.get('/pagos/mios', { token: otro.token })).body.pagos.length, 0);
  const mios = (await t.api.get('/pagos/mios', { token: duena.token })).body.pagos;
  assert.ok(mios.length >= 4);
  assert.equal((await t.api.get(`/pagos/${mios[0]._id}`, { token: otro.token })).status, 404);
  const datos = (await t.api.get('/usuarios/perfil/exportar', { token: duena.token })).body;
  assert.ok(datos.pagos.some((p) => p.importe_eur === 9.9 && p.estado === 'pagado'));
});
