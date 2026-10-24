import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, quejaValida } from './ayuda.js';

let t;
let vecino;
let otro;
let moderador;
let ayuntamiento;

before(async () => {
  t = await arrancar();
  vecino = await t.crearUsuario();
  otro = await t.crearUsuario();
  moderador = await t.crearUsuario({ rol: 'moderador' });
  ayuntamiento = await t.crearUsuario({ oficial: true });
});
after(() => t.detener());

const crear = async () => (await t.api.post('/quejas', quejaValida(), { token: vecino.token })).body.queja._id;
const tramitar = (id, quien, cuerpo) => t.api.patch(`/quejas/${id}/estado`, cuerpo, { token: quien.token });

test('tramitan el Ayuntamiento y el equipo; un vecino no, ni siquiera el autor', async () => {
  const id = await crear();
  assert.equal((await tramitar(id, otro, { estado: 'en_curso' })).status, 403);
  assert.equal((await tramitar(id, vecino, { estado: 'resuelto' })).status, 403);
  assert.equal((await tramitar(id, moderador, { estado: 'en_curso' })).status, 200);
  assert.equal((await tramitar(id, ayuntamiento, { estado: 'resuelto', nota: 'Bache reparado' })).status, 200);
});

test('el historial público dice si respondió el Ayuntamiento, pero no quién exactamente', async () => {
  const id = await crear();
  await tramitar(id, moderador, { estado: 'en_curso', nota: 'Pasado al Ayuntamiento' });
  await tramitar(id, ayuntamiento, { estado: 'resuelto', nota: 'Reparado el lunes' });

  for (const queja of [(await t.api.get(`/quejas/${id}`)).body.queja, (await t.api.get('/quejas')).body.quejas.find((q) => q._id === id)]) {
    assert.deepEqual(
      queja.historial_estados.map((h) => [h.estado, h.nota, h.oficial]),
      [
        ['en_curso', 'Pasado al Ayuntamiento', false],
        ['resuelto', 'Reparado el lunes', true],
      ],
    );
    assert.equal(JSON.stringify(queja.historial_estados).includes('moderador_id'), false);
  }
});

test('responder sin cambiar el estado vale; sin nota y con el mismo estado, no', async () => {
  const id = await crear();
  assert.equal((await tramitar(id, ayuntamiento, { estado: 'pendiente' })).status, 400);
  const r = await tramitar(id, ayuntamiento, { estado: 'pendiente', nota: 'Lo revisamos esta semana' });
  assert.equal(r.status, 200);
  assert.equal(r.body.historial_estados.at(-1).nota, 'Lo revisamos esta semana');
});

test('la fecha de resolución es la de la primera vez y reabrir la borra', async () => {
  const id = await crear();
  const primera = (await tramitar(id, ayuntamiento, { estado: 'resuelto' })).body.fecha_resolucion;
  assert.ok(primera);

  const conNota = await tramitar(id, ayuntamiento, { estado: 'resuelto', nota: 'Confirmado' });
  assert.equal(conNota.body.fecha_resolucion, primera, 'una nota no mueve la fecha');

  const reabierta = await tramitar(id, ayuntamiento, { estado: 'en_curso', nota: 'Ha vuelto a romperse' });
  assert.equal(reabierta.body.fecha_resolucion, null);
});

test('el autor recibe un aviso que dice quién y qué', async () => {
  const id = await crear();
  await tramitar(id, ayuntamiento, { estado: 'en_curso', nota: 'Enviado a obras' });
  const avisos = (await t.api.get('/notificaciones', { token: vecino.token })).body.notificaciones;
  const ultimo = avisos.find((n) => String(n.referencia_id) === id);
  assert.match(ultimo.mensaje, /El Ayuntamiento ha pasado tu queja .* a en curso: Enviado a obras/);
});

test('un estado que no existe se rechaza', async () => {
  const id = await crear();
  assert.equal((await tramitar(id, ayuntamiento, { estado: 'archivada' })).status, 400);
});

test('el resumen público cuenta estados, porcentaje resuelto y tiempos', async () => {
  const r = await t.api.get('/quejas/resumen');
  assert.equal(r.status, 200);
  const { total, por_estado: e, porcentaje_resueltas: pct } = r.body;
  assert.equal(total, e.pendiente + e.en_curso + e.resuelto);
  assert.ok(e.resuelto >= 2);
  assert.equal(pct, Math.round((e.resuelto / total) * 100));
  assert.equal(typeof r.body.dias_hasta_respuesta, 'number');
  assert.equal(typeof r.body.dias_hasta_resolucion, 'number');
});
