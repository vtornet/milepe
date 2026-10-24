import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar } from './ayuda.js';

let t;
let autor;
let otro;

before(async () => {
  t = await arrancar();
  autor = await t.crearUsuario();
  otro = await t.crearUsuario();
});
after(() => t.detener());

const anuncio = (extra = {}) => ({ titulo: 'Bici de paseo', contenido: 'Poco uso', categoria: 'vendo', precio: 60, ...extra });
const crear = async (extra, quien = autor) => {
  const r = await t.api.post('/anuncios', anuncio(extra), { token: quien.token });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.anuncio;
};
const titulos = async (query = '') => (await t.api.get(`/anuncios${query}`)).body.anuncios.map((a) => a.titulo);

test('publicar exige cuenta con perfil completo; leer, no', async () => {
  assert.equal((await t.api.post('/anuncios', anuncio())).status, 401);
  assert.equal((await t.api.get('/anuncios')).status, 200);
});

test('un "vendo" necesita precio, y solo un "vendo" lo lleva', async () => {
  assert.equal((await t.api.post('/anuncios', anuncio({ precio: undefined }), { token: autor.token })).status, 400);
  assert.equal((await t.api.post('/anuncios', anuncio({ precio: '' }), { token: autor.token })).status, 400);
  assert.equal((await t.api.post('/anuncios', anuncio({ categoria: 'regalo', precio: 10 }), { token: autor.token })).status, 400);
  assert.equal((await t.api.post('/anuncios', anuncio({ precio: -5 }), { token: autor.token })).status, 400);

  const regalo = await crear({ titulo: 'Regalo sofá', categoria: 'regalo', precio: undefined });
  assert.equal(regalo.precio, null);
  const gratis = await crear({ titulo: 'Libros a 0', precio: 0 });
  assert.equal(gratis.precio, 0);
});

test('un anuncio rechazado no deja un post huérfano', async () => {
  const antes = (await t.api.get('/posts?tipo=anuncio')).body.paginacion.total;
  await t.api.post('/anuncios', anuncio({ categoria: 'trueque' }), { token: autor.token });
  assert.equal((await t.api.get('/posts?tipo=anuncio')).body.paginacion.total, antes);
});

test('nace vigente 30 días y sale en el listado con la insignia del autor', async () => {
  const a = await crear({ titulo: 'Perro perdido', categoria: 'perdido', precio: undefined, zona: 'la_antilla' });
  const dias = (new Date(a.fecha_caducidad) - Date.now()) / 86400000;
  assert.ok(dias > 29.9 && dias <= 30);
  assert.equal(a.vigente, true);

  const listado = (await t.api.get('/anuncios')).body.anuncios.find((x) => x.titulo === 'Perro perdido');
  assert.equal(listado.vigente, true);
  assert.equal(listado.zona, 'la_antilla');
  assert.equal(listado.autor.nombre_usuario, autor.usuario.nombre_usuario);
});

test('filtros por categoría y zona; valores fuera de lista, 400', async () => {
  assert.ok((await titulos('?categoria=perdido')).every((x) => x === 'Perro perdido'));
  assert.deepEqual(await titulos('?zona=la_antilla'), ['Perro perdido']);
  assert.equal((await t.api.get('/anuncios?categoria=trueque')).status, 400);
  assert.equal((await t.api.get('/anuncios?zona=marte')).status, 400);
});

test('solo el autor cierra, reabre y renueva', async () => {
  const a = await crear({ titulo: 'Mesa' });

  assert.equal((await t.api.patch(`/anuncios/${a._id}/cerrar`, {}, { token: otro.token })).status, 403);
  assert.equal((await t.api.patch(`/anuncios/${a._id}/renovar`, {}, { token: otro.token })).status, 403);

  const cerrado = await t.api.patch(`/anuncios/${a._id}/cerrar`, {}, { token: autor.token });
  assert.equal(cerrado.body.cerrado, true);
  assert.equal((await titulos()).includes('Mesa'), false, 'cerrado deja de salir');
  assert.equal((await titulos('?incluirCerrados=true')).includes('Mesa'), true, 'pero no se borra');

  assert.equal((await t.api.patch(`/anuncios/${a._id}/renovar`, {}, { token: autor.token })).status, 400, 'cerrado no se renueva');

  const reabierto = await t.api.patch(`/anuncios/${a._id}/cerrar`, { cerrado: false }, { token: autor.token });
  assert.equal(reabierto.body.vigente, true);
});

test('un anuncio caducado no sale; renovarlo le da 30 días desde hoy', async () => {
  const a = await crear({ titulo: 'Caducado' });
  await t.mongoose.model('AnuncioDetalle').updateOne({ post_id: a._id }, { fecha_caducidad: new Date('2020-01-01') });
  assert.equal((await titulos()).includes('Caducado'), false);

  const r = await t.api.patch(`/anuncios/${a._id}/renovar`, {}, { token: autor.token });
  assert.equal(r.status, 200);
  const dias = (new Date(r.body.fecha_caducidad) - Date.now()) / 86400000;
  assert.ok(dias > 29.9 && dias <= 30);
  assert.equal((await titulos()).includes('Caducado'), true);
});

test('también sale en el Muro como cualquier publicación', async () => {
  const muro = (await t.api.get('/posts')).body.posts.map((p) => p.tipo);
  assert.ok(muro.includes('anuncio'));
});
