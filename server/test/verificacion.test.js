import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { arrancar, CONTRASEÑA } from './ayuda.js';

const SECRETO = 'whsec_prueba_verificacion';
process.env.STRIPE_SECRET_KEY = 'sk_test_prueba_verificacion';
process.env.STRIPE_WEBHOOK_SECRET = SECRETO;

const firmador = new Stripe('sk_test_prueba_verificacion');
const llamadas = { sesiones: [], actualizaciones: [], cancelaciones: [] };

let t;
let ana;
let admin;
let Usuario;

before(async () => {
  t = await arrancar();
  const { usarClienteStripe } = await import('../src/utils/stripe.js');
  usarClienteStripe({
    checkout: {
      sessions: {
        create: async (datos) => {
          llamadas.sesiones.push(datos);
          return { id: `cs_test_v${llamadas.sesiones.length}`, url: 'https://checkout.stripe.com/c/pay/v' };
        },
      },
    },
    subscriptions: {
      update: async (id, datos) => {
        llamadas.actualizaciones.push({ id, ...datos });
        return { id };
      },
      cancel: async (id) => {
        llamadas.cancelaciones.push(id);
        return { id };
      },
    },
    webhooks: firmador.webhooks,
  });
  Usuario = (await import('../src/models/Usuario.js')).default;
  ana = await t.crearUsuario();
  admin = await t.crearUsuario({ rol: 'admin' });
});
after(() => t.detener());

const webhook = async (evento) => {
  const cuerpo = JSON.stringify({ id: `evt_${Math.random()}`, ...evento });
  const firma = firmador.webhooks.generateTestHeaderString({ payload: cuerpo, secret: SECRETO });
  const r = await fetch(`${t.base}/pagos/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': firma },
    body: cuerpo,
  });
  return r.status;
};
const enDias = (d) => Math.floor(Date.now() / 1000) + d * 86400;
// Factura con la forma de la API "basil" (2025+) o la antigua.
const factura = ({ id, usuarioId, fin, basil = true, sub = 'sub_ana', cliente = 'cus_ana' }) => ({
  type: 'invoice.paid',
  data: {
    object: {
      id,
      customer: cliente,
      amount_paid: 150,
      ...(basil
        ? { parent: { subscription_details: { subscription: sub, metadata: { usuario_id: usuarioId, producto: 'verificacion' } } } }
        : { subscription: sub, subscription_details: { metadata: { usuario_id: usuarioId, producto: 'verificacion' } } }),
      lines: { data: [{ period: { start: enDias(0), end: fin } }] },
    },
  },
});
const mio = async (u) => (await t.api.get('/pagos/verificacion', { token: u.token })).body;
const perfil = async (u) => (await t.api.get(`/usuarios/${u.id}`)).body.usuario;

test('suscribirse abre Checkout en modo suscripción a 1,50 €/mes', async () => {
  assert.equal((await mio(ana)).verificado, false);
  const r = await t.api.post('/pagos/verificacion', {}, { token: ana.token });
  assert.equal(r.status, 201);
  const s = llamadas.sesiones.at(-1);
  assert.equal(s.mode, 'subscription');
  assert.equal(s.line_items[0].price_data.unit_amount, 150);
  assert.deepEqual(s.line_items[0].price_data.recurring, { interval: 'month' });
  assert.equal(s.subscription_data.metadata.usuario_id, ana.id);
});

test('la factura pagada verifica hasta el final del periodo, una sola vez y con la insignia pública', async () => {
  await webhook({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', customer: 'cus_ana', subscription: 'sub_ana', metadata: { usuario_id: ana.id } } } });
  assert.equal(await webhook(factura({ id: 'in_1', usuarioId: ana.id, fin: enDias(30) })), 200);
  assert.equal(await webhook(factura({ id: 'in_1', usuarioId: ana.id, fin: enDias(30) })), 200, 'repetido');

  const estado = await mio(ana);
  assert.equal(estado.verificado, true);
  assert.equal(estado.suscripcion.estado, 'activa');
  const dias = (new Date(estado.hasta) - Date.now()) / 86400000;
  assert.ok(dias > 29 && dias <= 30);

  const publico = await perfil(ana);
  assert.ok(new Date(publico.verificado_hasta) > new Date(), 'viaja en el perfil público');
  assert.equal(publico.suscripcion, undefined, 'el estado de Stripe no es público');

  const { default: Pago } = await import('../src/models/Pago.js');
  assert.equal(await Pago.countDocuments({ producto: 'verificacion', usuario_id: ana.id }), 1);
  // Y sale en el panel del admin como cobro.
  const panel = (await t.api.get('/pagos/admin?modo=prueba', { token: admin.token })).body;
  assert.equal(panel.resumen.cobrado_total, 150);
});

test('ya suscrita no puede volver a suscribirse', async () => {
  assert.equal((await t.api.post('/pagos/verificacion', {}, { token: ana.token })).status, 409);
});

test('darse de baja respeta lo pagado; reactivar vuelve a renovar', async () => {
  const baja = await t.api.post('/pagos/verificacion/baja', {}, { token: ana.token });
  assert.equal(baja.status, 200);
  assert.deepEqual(llamadas.actualizaciones.at(-1), { id: 'sub_ana', cancel_at_period_end: true });
  assert.equal(baja.body.verificado, true, 'sigue verificada hasta el final del mes');
  assert.equal(baja.body.suscripcion.renovacion_cancelada, true);

  await webhook({ type: 'customer.subscription.updated', data: { object: { id: 'sub_ana', customer: 'cus_ana', status: 'active', cancel_at_period_end: true, metadata: { usuario_id: ana.id, producto: 'verificacion' }, items: { data: [{ current_period_end: enDias(30) }] } } } });
  assert.equal((await mio(ana)).suscripcion.renovacion_cancelada, true);

  const re = await t.api.post('/pagos/verificacion/reactivar', {}, { token: ana.token });
  assert.equal(re.body.suscripcion.renovacion_cancelada, false);
  assert.deepEqual(llamadas.actualizaciones.at(-1), { id: 'sub_ana', cancel_at_period_end: false });
});

test('al acabar la suscripción, la insignia dura hasta el fin del periodo y luego se va sola', async () => {
  await webhook({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_ana', customer: 'cus_ana', status: 'canceled', metadata: { usuario_id: ana.id } } } });
  const estado = await mio(ana);
  assert.equal(estado.suscripcion.estado, 'cancelada');
  assert.equal(estado.verificado, true, 'el mes pagado se respeta');

  await Usuario.updateOne({ _id: ana.id }, { verificado_hasta: new Date(Date.now() - 1000) });
  assert.equal((await mio(ana)).verificado, false);
  // Y puede volver a suscribirse.
  assert.equal((await t.api.post('/pagos/verificacion', {}, { token: ana.token })).status, 201);
  assert.equal(llamadas.sesiones.at(-1).customer, 'cus_ana', 'reutiliza su cliente de Stripe');
});

test('la factura con la forma antigua de la API también vale; un cobro fallido no quita la insignia', async () => {
  const beto = await t.crearUsuario();
  await webhook(factura({ id: 'in_beto', usuarioId: beto.id, fin: enDias(30), basil: false, sub: 'sub_beto', cliente: 'cus_beto' }));
  assert.equal((await mio(beto)).verificado, true);
  await webhook({ type: 'invoice.payment_failed', data: { object: { id: 'in_beto2', customer: 'cus_beto', subscription_details: { metadata: { usuario_id: beto.id } }, lines: { data: [] } } } });
  const e = await mio(beto);
  assert.equal(e.suscripcion.estado, 'impagada');
  assert.equal(e.verificado, true);
});

test('verificación manual del admin: sin pagar, solo el admin, y a un admin no se le quita', async () => {
  const carla = await t.crearUsuario();
  assert.equal((await t.api.patch(`/usuarios/${carla.id}/verificado`, { verificado: true }, { token: ana.token })).status, 403);
  const r = await t.api.patch(`/usuarios/${carla.id}/verificado`, { verificado: true }, { token: admin.token });
  assert.equal(r.status, 200);
  assert.equal(r.body.usuario.verificado, true);
  assert.equal((await perfil(carla)).verificado_manual, true);
  assert.equal((await t.api.post('/pagos/verificacion', {}, { token: carla.token })).status, 409, 'no tiene que pagar');

  assert.equal((await t.api.patch(`/usuarios/${admin.id}/verificado`, { verificado: false }, { token: admin.token })).status, 409);
  assert.equal((await t.api.patch(`/usuarios/${carla.id}/verificado`, { verificado: 'si' }, { token: admin.token })).status, 400);
});

test('los admin quedan verificados al arrancar', async () => {
  const otroAdmin = await t.crearUsuario({ rol: 'admin' });
  await Usuario.updateOne({ _id: otroAdmin.id }, { verificado_manual: false });
  await Usuario.asegurarVerificacionDeAdmins();
  assert.equal((await perfil(otroAdmin)).verificado_manual, true);
});

test('borrar la cuenta cancela la suscripción y quita la insignia', async () => {
  const dani = await t.crearUsuario();
  await webhook({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', customer: 'cus_dani', subscription: 'sub_dani', metadata: { usuario_id: dani.id } } } });
  await webhook(factura({ id: 'in_dani', usuarioId: dani.id, fin: enDias(30), sub: 'sub_dani', cliente: 'cus_dani' }));
  const r = await t.api.delete('/usuarios/perfil', { token: dani.token, cuerpo: { contraseña: CONTRASEÑA } });
  assert.equal(r.status, 200);
  assert.ok(llamadas.cancelaciones.includes('sub_dani'));
  const u = await Usuario.findById(dani.id);
  assert.equal(u.estaVerificado(), false);
});
