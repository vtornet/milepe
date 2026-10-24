import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, CONTRASEÑA } from './ayuda.js';

let t;
let creadora;
let vecino;
let otro;
let admin;
let grupoId;

before(async () => {
  t = await arrancar();
  creadora = await t.crearUsuario();
  vecino = await t.crearUsuario();
  otro = await t.crearUsuario();
  admin = await t.crearUsuario({ rol: 'admin' });
});
after(() => t.detener());

const grupo = (extra = {}) => ({ nombre: 'Peña El Terrao', descripcion: 'Los del Terrao', categoria: 'pena', ...extra });

test('crear un grupo: la creadora entra como miembro y el nombre no se repite', async () => {
  const r = await t.api.post('/grupos', grupo({ num_miembros: 99, activo: false }), { token: creadora.token });
  assert.equal(r.status, 201);
  grupoId = r.body.grupo._id;
  assert.equal(r.body.grupo.num_miembros, 1, 'no acepta el contador del cliente');
  assert.equal(r.body.grupo.activo, true);

  assert.equal((await t.api.post('/grupos', grupo({ nombre: 'peña el  TERRAO' }), { token: vecino.token })).status, 409);
  assert.equal((await t.api.post('/grupos', grupo({ categoria: 'secta' }), { token: vecino.token })).status, 400);
  assert.deepEqual((await t.api.get('/grupos/mios', { token: creadora.token })).body.grupos, [grupoId]);
});

test('solo los miembros publican; unirse es idempotente', async () => {
  const publicar = (quien) =>
    t.api.post(`/grupos/${grupoId}/publicaciones`, { titulo: 'Quedada', contenido: 'El sábado #feria' }, { token: quien.token });

  assert.equal((await publicar(vecino)).status, 403);
  await t.api.post(`/grupos/${grupoId}/miembros`, {}, { token: vecino.token });
  const dos = await t.api.post(`/grupos/${grupoId}/miembros`, {}, { token: vecino.token });
  assert.equal(dos.body.num_miembros, 2, 'dos toques cuentan uno');
  assert.equal((await t.api.get(`/grupos/${grupoId}`, { token: vecino.token })).body.soy_miembro, true);

  const r = await publicar(vecino);
  assert.equal(r.status, 201);
  assert.equal(r.body.post.tipo, 'grupo');

  const lista = await t.api.get(`/grupos/${grupoId}/publicaciones`);
  assert.deepEqual(lista.body.posts.map((p) => p._id), [r.body.post._id], 'se lee sin cuenta');

  // No sale en el Muro general, pero sí en la ficha del vecino y en su etiqueta.
  assert.ok(!(await t.api.get('/posts')).body.posts.some((p) => p._id === r.body.post._id));
  assert.ok((await t.api.get(`/posts?autor=${vecino.id}`)).body.posts.some((p) => p._id === r.body.post._id));
  assert.ok((await t.api.get('/posts?etiqueta=feria')).body.posts.some((p) => p._id === r.body.post._id));
});

test('salir baja el contador; la creadora no puede salirse', async () => {
  const r = await t.api.delete(`/grupos/${grupoId}/miembros`, { token: vecino.token });
  assert.equal(r.body.num_miembros, 1);
  assert.equal((await t.api.delete(`/grupos/${grupoId}/miembros`, { token: vecino.token })).body.num_miembros, 1);
  assert.equal((await t.api.delete(`/grupos/${grupoId}/miembros`, { token: creadora.token })).status, 400);
});

test('editar: la creadora sí, otro no; retirar, solo un admin', async () => {
  assert.equal((await t.api.patch(`/grupos/${grupoId}`, { descripcion: 'Hackeado' }, { token: otro.token })).status, 403);
  const r = await t.api.patch(`/grupos/${grupoId}`, { descripcion: 'Peña flamenca', creador_id: otro.id }, { token: creadora.token });
  assert.equal(r.status, 200);
  assert.equal(r.body.grupo.descripcion, 'Peña flamenca');
  assert.equal(String(r.body.grupo.creador_id._id ?? r.body.grupo.creador_id), creadora.id, 'no cambia de creador');

  assert.equal((await t.api.patch(`/grupos/${grupoId}`, { activo: false }, { token: creadora.token })).status, 403);
  assert.equal((await t.api.patch(`/grupos/${grupoId}`, { activo: false }, { token: admin.token })).status, 200);
  assert.equal((await t.api.get(`/grupos/${grupoId}`)).status, 404, 'retirado no existe para el público');
  assert.equal((await t.api.get('/grupos')).body.grupos.length, 0);
  assert.equal((await t.api.get(`/grupos/${grupoId}`, { token: admin.token })).status, 200);
  await t.api.patch(`/grupos/${grupoId}`, { activo: true }, { token: admin.token });
});

test('al eliminar la cuenta sale de sus grupos y el contador baja', async () => {
  await t.api.post(`/grupos/${grupoId}/miembros`, {}, { token: otro.token });
  assert.equal((await t.api.get(`/grupos/${grupoId}`)).body.grupo.num_miembros, 2);

  const exportado = await t.api.get('/usuarios/perfil/exportar', { token: otro.token });
  assert.deepEqual(exportado.body.grupos.map((g) => g.grupo), ['Peña El Terrao']);

  const r = await t.api.delete('/usuarios/perfil', { token: otro.token, cuerpo: { contraseña: CONTRASEÑA } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await t.api.get(`/grupos/${grupoId}`)).body.grupo.num_miembros, 1);
});
