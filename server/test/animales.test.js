import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar } from './ayuda.js';

let t;
let autor;
let otro;
let moderador;

before(async () => {
  t = await arrancar();
  autor = await t.crearUsuario();
  otro = await t.crearUsuario();
  moderador = await t.crearUsuario({ rol: 'moderador' });
});
after(() => t.detener());

const FOTO = 'https://res.cloudinary.com/x/perro.jpg';
const ayer = () => new Date(Date.now() - 86400000).toISOString();
const animal = (extra = {}) => ({
  titulo: 'Se ha perdido Toby',
  contenido: 'Mestizo marrón, collar rojo',
  categoria: 'perdido',
  especie: 'perro',
  imagenes: [FOTO],
  fecha_suceso: ayer(),
  ...extra,
});
const publicar = (extra, quien = autor) => t.api.post('/animales', animal(extra), { token: quien.token });
const titulos = async (q = '') => (await t.api.get(`/animales${q}`)).body.animales.map((a) => a.titulo);

test('la foto es obligatoria y no deja un post huérfano si falta', async () => {
  const antes = (await t.api.get('/posts?tipo=animal')).body.paginacion.total;
  assert.equal((await publicar({ imagenes: [] })).status, 400);
  assert.equal((await publicar({ imagenes: undefined })).status, 400);
  assert.equal((await t.api.get('/posts?tipo=animal')).body.paginacion.total, antes);
});

test('perdido y encontrado exigen la fecha, y no puede ser futura; la adopción no', async () => {
  assert.equal((await publicar({ fecha_suceso: undefined })).status, 400);
  assert.equal((await publicar({ categoria: 'encontrado', fecha_suceso: undefined })).status, 400);
  assert.equal((await publicar({ fecha_suceso: '2099-01-01T00:00:00Z' })).status, 400);
  assert.equal((await publicar({ titulo: 'Gatita en adopción', categoria: 'adopcion', especie: 'gato', fecha_suceso: undefined })).status, 201);
});

test('especie y categoría fuera de lista se rechazan', async () => {
  assert.equal((await publicar({ especie: 'dragon' })).status, 400);
  assert.equal((await publicar({ categoria: 'vendo' })).status, 400);
});

test('se publica con ubicación, nombre, sexo y teléfono, y sale en el listado', async () => {
  const r = await publicar({ nombre: 'Toby', sexo: 'macho', zona: 'la_antilla', ubicacion: { lat: 37.205, lng: -7.217 }, telefono_contacto: '600 00 00 00' });
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.animal.ubicacion, { lat: 37.205, lng: -7.217 });

  const listado = (await t.api.get('/animales')).body.animales.find((a) => a._id === r.body.animal._id);
  assert.deepEqual(listado.ubicacion, { lat: 37.205, lng: -7.217 }, 'en el listado también como lat/lng');
  assert.equal(listado.telefono_contacto, '600 00 00 00');
  assert.equal(listado.nombre, 'Toby');
  assert.equal(listado.autor.nombre_usuario, autor.usuario.nombre_usuario);
});

test('filtros por categoría, especie y zona', async () => {
  assert.ok((await titulos('?especie=gato')).every((x) => x === 'Gatita en adopción'));
  assert.ok((await titulos('?categoria=adopcion')).includes('Gatita en adopción'));
  assert.ok((await titulos('?zona=la_antilla')).length >= 1);
  assert.equal((await t.api.get('/animales?especie=dragon')).status, 400);
});

test('resolver: el autor o el equipo, no otro vecino; deja de salir pero no se borra', async () => {
  const id = (await publicar({ titulo: 'Perdida Luna' })).body.animal._id;

  assert.equal((await t.api.patch(`/animales/${id}/resolver`, {}, { token: otro.token })).status, 403);

  const r = await t.api.patch(`/animales/${id}/resolver`, {}, { token: autor.token });
  assert.equal(r.body.resuelto, true);
  assert.ok(r.body.fecha_resolucion);
  assert.equal((await titulos()).includes('Perdida Luna'), false);
  assert.equal((await titulos('?incluirResueltos=true')).includes('Perdida Luna'), true);

  const deshacer = await t.api.patch(`/animales/${id}/resolver`, { resuelto: false }, { token: moderador.token });
  assert.equal(deshacer.body.resuelto, false);
  assert.equal(deshacer.body.fecha_resolucion, null);
});

test('al editar no se puede dejar sin fotos', async () => {
  const id = (await publicar({ titulo: 'Con foto' })).body.animal._id;
  const r = await t.api.patch(`/posts/${id}`, { imagenes: [] }, { token: autor.token });
  assert.equal(r.status, 400);
});
