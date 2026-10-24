import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar } from './ayuda.js';

let t;
let vecino;
let ayuntamiento;
let admin;

before(async () => {
  t = await arrancar();
  vecino = await t.crearUsuario();
  ayuntamiento = await t.crearUsuario();
  admin = await t.crearUsuario({ rol: 'admin' });
});
after(() => t.detener());

const aviso = (extra = {}) => ({ titulo: 'Corte de agua', contenido: 'Calle Real, de 9 a 13 h', categoria: 'agua', ...extra });
const publicar = (quien, extra) => t.api.post('/avisos', aviso(extra), { token: quien.token });

test('solo un admin marca una cuenta como oficial; nadie puede marcarse a sí mismo', async () => {
  assert.equal((await t.api.patch(`/usuarios/${ayuntamiento.id}/oficial`, { oficial: true }, { token: vecino.token })).status, 403);
  assert.equal((await t.api.patch(`/usuarios/${ayuntamiento.id}/oficial`, { oficial: 'si' }, { token: admin.token })).status, 400);

  // Colarlo en la edición del propio perfil no tiene efecto.
  await t.api.put('/usuarios/perfil', { oficial: true }, { token: vecino.token });
  assert.equal((await t.api.get(`/usuarios/${vecino.id}`)).body.usuario.oficial, false);

  const r = await t.api.patch(`/usuarios/${ayuntamiento.id}/oficial`, { oficial: true }, { token: admin.token });
  assert.equal(r.status, 200);
  assert.equal(r.body.usuario.oficial, true);
  assert.equal((await t.api.get(`/usuarios/${ayuntamiento.id}`)).body.usuario.oficial, true, 'el perfil público lo muestra');
});

test('un vecino no puede publicar avisos; la cuenta oficial y un admin sí', async () => {
  assert.equal((await publicar(vecino)).status, 403);
  assert.equal((await publicar(ayuntamiento)).status, 201);
  assert.equal((await publicar(admin, { titulo: 'Bando' , categoria: 'bando' })).status, 201);
});

test('la insignia de oficial viaja con el autor en avisos, Muro y secciones', async () => {
  const avisos = (await t.api.get('/avisos')).body.avisos;
  const delAyuntamiento = avisos.find((a) => a.titulo === 'Corte de agua');
  assert.equal(delAyuntamiento.autor.oficial, true);

  const muro = (await t.api.get('/posts')).body.posts;
  assert.equal(muro.find((p) => p.titulo === 'Corte de agua').autor_id.oficial, true);

  await t.api.post('/quejas', { titulo: 'Q', contenido: 'x', categoria: 'obras', ubicacion: { lat: 37.25, lng: -7.2 } }, { token: ayuntamiento.token });
  const quejas = (await t.api.get('/quejas')).body.quejas;
  assert.equal(quejas[0].autor.oficial, true, 'también en los listados por agregación');
});

test('un aviso caducado deja de salir salvo que se pidan los caducados', async () => {
  await publicar(ayuntamiento, { titulo: 'Corte antiguo', vigente_hasta: '2020-01-01T00:00:00Z' });
  await publicar(ayuntamiento, { titulo: 'Obras futuras', categoria: 'obras', vigente_hasta: '2099-01-01T00:00:00Z' });

  const vigentes = (await t.api.get('/avisos')).body.avisos.map((a) => a.titulo);
  assert.equal(vigentes.includes('Corte antiguo'), false);
  assert.equal(vigentes.includes('Obras futuras'), true);

  const todos = (await t.api.get('/avisos?incluirCaducados=true')).body.avisos;
  assert.equal(todos.find((a) => a.titulo === 'Corte antiguo').vigente, false);
});

test('categoría y fecha no válidas se rechazan sin dejar un post huérfano', async () => {
  const antes = (await t.api.get('/posts?tipo=aviso')).body.paginacion.total;
  assert.equal((await publicar(ayuntamiento, { categoria: 'marte' })).status, 400);
  assert.equal((await publicar(ayuntamiento, { vigente_hasta: 'mañana' })).status, 400);
  assert.equal((await t.api.get('/posts?tipo=aviso')).body.paginacion.total, antes);
});

test('filtrar por categoría y limitar', async () => {
  const obras = (await t.api.get('/avisos?categoria=obras')).body.avisos;
  assert.ok(obras.length > 0 && obras.every((a) => a.categoria === 'obras'));
  assert.equal((await t.api.get('/avisos?limite=1')).body.avisos.length, 1);
  assert.equal((await t.api.get('/avisos?categoria=marte')).status, 400);
});

test('quitar la marca de oficial le impide volver a publicar avisos', async () => {
  await t.api.patch(`/usuarios/${ayuntamiento.id}/oficial`, { oficial: false }, { token: admin.token });
  assert.equal((await publicar(ayuntamiento)).status, 403);
});
