import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import webpush from 'web-push';
import { arrancar } from './ayuda.js';

// web-push solo habla HTTPS, así que en vez de un servicio de push falso se
// sustituye sendNotification (el módulo es el mismo objeto que usa
// utils/push.js). El cifrado no se prueba aquí; quién recibe, sí.
// Las claves VAPID se fijan antes de arrancar (utils/push.js las lee una vez).
const claves = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = claves.publicKey;
process.env.VAPID_PRIVATE_KEY = claves.privateKey;

let t;
let admin;
const recibidos = [];
webpush.sendNotification = async ({ endpoint }) => {
  recibidos.push(new URL(endpoint).pathname);
  if (endpoint.endsWith('/caducada')) throw Object.assign(new Error('Gone'), { statusCode: 410 });
};

const claveNavegador = () => {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') };
};

before(async () => {
  const base = 'https://push.ejemplo';

  t = await arrancar();
  admin = await t.crearUsuario({ rol: 'admin' });
  const vecinos = [await t.crearUsuario(), await t.crearUsuario()];
  const { default: Suscripcion } = await import('../src/models/Suscripcion.js');
  await Suscripcion.create([
    { usuario_id: vecinos[0].id, endpoint: `${base}/uno`, claves: claveNavegador() },
    { usuario_id: vecinos[1].id, endpoint: `${base}/dos`, claves: claveNavegador() },
    { usuario_id: vecinos[1].id, endpoint: `${base}/caducada`, claves: claveNavegador() },
  ]);
});
after(() => t.detener());

const esperar = async (condicion) => {
  for (let i = 0; i < 50 && !condicion(); i += 1) await new Promise((ok) => setTimeout(ok, 100));
};

const aviso = (extra) => ({ titulo: 'Corte de agua', contenido: 'Calle Real, ahora', categoria: 'agua', ...extra });

test('un aviso normal no manda push a nadie', async () => {
  const r = await t.api.post('/avisos', aviso(), { token: admin.token });
  assert.equal(r.status, 201);
  assert.equal(r.body.aviso.urgente, false);
  await new Promise((ok) => setTimeout(ok, 500));
  assert.equal(recibidos.length, 0);
});

test('un aviso urgente llega a todos los navegadores y borra los caducados', async () => {
  const r = await t.api.post('/avisos', aviso({ urgente: true }), { token: admin.token });
  assert.equal(r.status, 201);
  assert.equal(r.body.aviso.urgente, true);
  await esperar(() => recibidos.length >= 3);
  assert.deepEqual([...recibidos].sort(), ['/caducada', '/dos', '/uno']);

  const { default: Suscripcion } = await import('../src/models/Suscripcion.js');
  await new Promise((ok) => setTimeout(ok, 300));
  assert.equal(await Suscripcion.countDocuments(), 2, 'la que respondió 410 se borra');
});

test('urgente tiene que ser booleano', async () => {
  assert.equal((await t.api.post('/avisos', aviso({ urgente: 'si' }), { token: admin.token })).status, 400);
});
