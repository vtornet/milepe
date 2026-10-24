import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar } from './ayuda.js';

let t;
let admin;
let vecino;
const ids = [];

before(async () => {
  t = await arrancar();
  admin = await t.crearUsuario({ rol: 'admin' });
  vecino = await t.crearUsuario();
  for (const titulo of ['Playa A', 'Playa B', 'Playa C']) {
    const r = await t.api.post('/turismo', { seccion: 'sol_y_playa', titulo, descripcion: 'Arena' }, { token: admin.token });
    ids.push(r.body.recurso._id);
  }
  await t.api.patch(`/turismo/${ids[1]}`, { activo: false }, { token: admin.token });
});
after(() => t.detener());

const titulos = async () => (await t.api.get('/turismo/todos?seccion=sol_y_playa', { token: admin.token })).body.recursos.map((r) => r.titulo);

test('un admin reordena una sección entera, ocultos incluidos', async () => {
  const r = await t.api.put('/turismo/orden', { seccion: 'sol_y_playa', ids: [ids[2], ids[1], ids[0]] }, { token: admin.token });
  assert.equal(r.status, 200);
  assert.deepEqual(await titulos(), ['Playa C', 'Playa B', 'Playa A']);
  const publicos = (await t.api.get('/turismo?seccion=sol_y_playa')).body.recursos.map((x) => x.titulo);
  assert.deepEqual(publicos, ['Playa C', 'Playa A']);
});

test('una lista incompleta, repetida o ajena se rechaza sin tocar el orden', async () => {
  const antes = await titulos();
  for (const lista of [[ids[0], ids[1]], [ids[0], ids[0], ids[1]], [ids[0], ids[1], admin.id]]) {
    const r = await t.api.put('/turismo/orden', { seccion: 'sol_y_playa', ids: lista }, { token: admin.token });
    assert.equal(r.status, 409);
  }
  assert.equal((await t.api.put('/turismo/orden', { seccion: 'nada', ids }, { token: admin.token })).status, 400);
  assert.deepEqual(await titulos(), antes);
});

test('un vecino no puede reordenar', async () => {
  assert.equal((await t.api.put('/turismo/orden', { seccion: 'sol_y_playa', ids }, { token: vecino.token })).status, 403);
});
