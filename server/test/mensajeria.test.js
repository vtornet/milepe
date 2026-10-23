import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar } from './ayuda.js';

let t;
let ana;
let beto;
let intruso;

before(async () => {
  t = await arrancar();
  ana = await t.crearUsuario();
  beto = await t.crearUsuario();
  intruso = await t.crearUsuario();
});
after(() => t.detener());

const seguir = (quien, aQuien) => t.api.post(`/seguimientos/${aQuien.id}`, {}, { token: quien.token });
const dejarDeSeguir = (quien, aQuien) => t.api.delete(`/seguimientos/${aQuien.id}`, { token: quien.token });
const abrir = (quien, con) => t.api.post(`/conversaciones/con/${con.id}`, {}, { token: quien.token });
const enviar = (quien, conversacionId, texto) =>
  t.api.post(`/conversaciones/${conversacionId}/mensajes`, { texto }, { token: quien.token });

test('seguir es unilateral y no basta para escribir: hace falta seguirse los dos', async () => {
  assert.equal((await seguir(ana, beto)).status, 201);

  const solo = await abrir(ana, beto);
  assert.equal(solo.status, 403);
  assert.equal(solo.body.razon, 'sin_seguimiento_mutuo');

  await seguir(beto, ana);
  assert.equal((await abrir(ana, beto)).status, 200);
});

test('seguir dos veces es idempotente: no duplica el seguimiento ni el aviso', async () => {
  const a = await t.crearUsuario();
  const b = await t.crearUsuario();
  assert.equal((await seguir(a, b)).status, 201);
  assert.equal((await seguir(a, b)).status, 200);

  const avisos = await t.api.get('/notificaciones', { token: b.token });
  assert.equal(avisos.body.notificaciones.filter((n) => n.tipo === 'seguidor_nuevo').length, 1);
});

test('no puedes seguirte a ti mismo', async () => {
  assert.equal((await seguir(ana, ana)).status, 400);
});

test('los mensajes se envían, se leen y se marcan como leídos', async () => {
  const conversacionId = (await abrir(ana, beto)).body.conversacion._id;

  assert.equal((await enviar(ana, conversacionId, 'Hola Beto')).status, 201);

  const lectura = await t.api.get(`/conversaciones/${conversacionId}/mensajes`, { token: beto.token });
  assert.equal(lectura.body.mensajes.at(-1).texto, 'Hola Beto');
  assert.equal(lectura.body.mensajes.at(-1).leido_en ?? null, null);

  const leida = await t.api.patch(`/conversaciones/${conversacionId}/leida`, {}, { token: beto.token });
  assert.equal(leida.body.marcados, 1);
});

test('abrir la conversación con la misma persona desde los dos lados da el mismo hilo', async () => {
  const desdeAna = await abrir(ana, beto);
  const desdeBeto = await abrir(beto, ana);
  assert.equal(desdeAna.body.conversacion._id, desdeBeto.body.conversacion._id);
});

test('un tercero no puede leer, escribir ni marcar el hilo de otros, y ni siquiera se le dice que existe', async () => {
  const conversacionId = (await abrir(ana, beto)).body.conversacion._id;

  assert.equal((await t.api.get(`/conversaciones/${conversacionId}/mensajes`, { token: intruso.token })).status, 404);
  assert.equal((await enviar(intruso, conversacionId, 'Me cuelo')).status, 404);
  assert.equal((await t.api.patch(`/conversaciones/${conversacionId}/leida`, {}, { token: intruso.token })).status, 404);
});

test('dejar de seguir deja el hilo en solo lectura: se conserva el historial pero no se puede escribir', async () => {
  const conversacionId = (await abrir(ana, beto)).body.conversacion._id;
  await dejarDeSeguir(beto, ana);

  const bloqueado = await enviar(ana, conversacionId, 'Sigues ahí?');
  assert.equal(bloqueado.status, 403);
  assert.equal(bloqueado.body.razon, 'sin_seguimiento_mutuo');

  const lectura = await t.api.get(`/conversaciones/${conversacionId}/mensajes`, { token: ana.token });
  assert.equal(lectura.status, 200);
  assert.equal(lectura.body.solo_lectura, true);
  assert.ok(lectura.body.mensajes.length > 0, 'el historial sigue ahí');

  await seguir(beto, ana);
  assert.equal((await enviar(ana, conversacionId, 'Ya estás')).status, 201);
});

test('bloquear rompe el seguimiento en los dos sentidos y cierra el canal', async () => {
  const conversacionId = (await abrir(ana, beto)).body.conversacion._id;

  assert.equal((await t.api.post(`/usuarios/${beto.id}/bloquear`, {}, { token: ana.token })).status, 201);

  const estado = await t.api.get(`/seguimientos/estado/${beto.id}`, { token: ana.token });
  assert.equal(estado.body.sigo, false);
  assert.equal(estado.body.me_sigue, false);

  const intento = await enviar(beto, conversacionId, 'Déjame hablar');
  assert.equal(intento.status, 403);

  const reabrir = await abrir(beto, ana);
  assert.equal(reabrir.status, 403);
});

test('quien te ha bloqueado no puede comentar en tu publicación', async () => {
  const a = await t.crearUsuario();
  const b = await t.crearUsuario();
  const queja = await t.api.post(
    '/quejas',
    { titulo: 'Mía', contenido: 'x', categoria: 'obras', ubicacion: { lat: 37.2, lng: -7.2 } },
    { token: a.token },
  );
  await t.api.post(`/usuarios/${b.id}/bloquear`, {}, { token: a.token });

  const r = await t.api.post(`/posts/${queja.body.queja._id}/comentarios`, { texto: 'Hola' }, { token: b.token });
  assert.equal(r.status, 403);
});

test('un mensaje privado solo lo pueden reportar los dos del hilo', async () => {
  const a = await t.crearUsuario();
  const b = await t.crearUsuario();
  const ajeno = await t.crearUsuario();
  await seguir(a, b);
  await seguir(b, a);
  const conversacionId = (await abrir(a, b)).body.conversacion._id;
  const mensaje = (await enviar(a, conversacionId, 'Algo feo')).body.mensaje;

  const reportar = (quien) =>
    t.api.post(
      '/moderacion/reportes',
      { contenido_tipo: 'mensaje', contenido_id: mensaje._id, motivo: 'acoso' },
      { token: quien.token },
    );

  assert.equal((await reportar(ajeno)).status, 404, 'un extraño no puede meter un mensaje ajeno en la cola');
  assert.equal((await reportar(b)).status, 201);
});
