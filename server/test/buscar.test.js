import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, quejaValida } from './ayuda.js';
import { patronSinTildes } from '../src/controllers/buscarController.js';

test('el patrón ignora tildes y mayúsculas, y escapa los símbolos', () => {
  const p = patronSinTildes('camion');
  assert.ok(p.test('Camión de la basura'));
  assert.ok(patronSinTildes('ESPAÑA').test('plaza de españa'));
  assert.ok(patronSinTildes('pena').test('Peña flamenca'));
  assert.doesNotThrow(() => patronSinTildes('(hola'));
  assert.ok(patronSinTildes('1+1').test('1+1=2'));
});

let t;
let vecino;
let admin;

before(async () => {
  t = await arrancar();
  vecino = await t.crearUsuario({ nombre_usuario: 'pepa_lepera' });
  admin = await t.crearUsuario({ rol: 'admin' });

  await t.api.post('/quejas', quejaValida({ titulo: 'Bache enorme en la calle Real', contenido: 'Peligroso para las motos' }), { token: vecino.token });
  await t.api.post('/quejas', quejaValida({ titulo: 'Farola apagada', contenido: 'En la avenida de Andalucía' }), { token: vecino.token });
  await t.api.post('/contactos-interes', { nombre: 'Policía Local', categoria: 'policia_local', telefono: '959 00 00 00' }, { token: admin.token });
  await t.api.post('/farmacias', { nombre: 'Farmacia Vacas Barranco', direccion: 'Avenida Andalucía, 55' }, { token: admin.token });
});
after(() => t.detener());

const buscar = (q, token) => t.api.get(`/buscar?q=${encodeURIComponent(q)}`, { token });

test('encuentra palabras a medias y sin tildes', async () => {
  assert.deepEqual((await buscar('bach')).body.publicaciones.map((p) => p.titulo), ['Bache enorme en la calle Real']);
  assert.equal((await buscar('andalucia')).body.publicaciones[0].titulo, 'Farola apagada');
});

test('todas las palabras tienen que aparecer', async () => {
  assert.equal((await buscar('bache motos')).body.publicaciones.length, 1);
  assert.equal((await buscar('bache farola')).body.publicaciones.length, 0);
});

test('busca también en contactos y farmacias', async () => {
  const r = (await buscar('policia')).body;
  assert.equal(r.contactos[0].nombre, 'Policía Local');
  assert.equal((await buscar('andalucía')).body.farmacias[0].nombre, 'Farmacia Vacas Barranco');
});

test('los vecinos solo aparecen con sesión', async () => {
  assert.deepEqual((await buscar('pepa')).body.vecinos, []);
  const conSesion = (await buscar('pepa', admin.token)).body.vecinos;
  assert.equal(conSesion[0].nombre_usuario, 'pepa_lepera');
  assert.equal('email' in conSesion[0], false);
});

test('lo oculto o eliminado no sale', async () => {
  const id = (await t.api.post('/quejas', quejaValida({ titulo: 'Secreto borrado' }), { token: vecino.token })).body.queja._id;
  await t.api.delete(`/posts/${id}`, { token: vecino.token });
  assert.equal((await buscar('secreto')).body.publicaciones.length, 0);
});

test('una búsqueda vacía o de una letra es 400; símbolos raros no rompen nada', async () => {
  assert.equal((await buscar('')).status, 400);
  assert.equal((await buscar('a')).status, 400);
  assert.equal((await buscar('(((')).status, 200);
});
