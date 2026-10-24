import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, CONTRASEÑA } from './ayuda.js';

let t;
let autora;
let ana;
let beto;
let id;

const enFuturo = (dias) => new Date(Date.now() + dias * 86400000).toISOString();
const encuesta = (extra = {}) => ({
  titulo: '¿Dónde ponemos el nuevo parque?',
  contenido: 'Consulta vecinal',
  opciones: ['Junto al colegio', 'En La Antilla', 'En el centro'],
  cierra_en: enFuturo(7),
  ...extra,
});

before(async () => {
  t = await arrancar();
  autora = await t.crearUsuario();
  ana = await t.crearUsuario();
  beto = await t.crearUsuario();
  id = (await t.api.post('/encuestas', encuesta(), { token: autora.token })).body.encuesta._id;
});
after(() => t.detener());

const votar = (quien, opcion) => t.api.post(`/encuestas/${id}/votar`, { opcion }, { token: quien.token });
const ver = (quien) => t.api.get(`/encuestas/${id}`, quien ? { token: quien.token } : {});

test('crear exige entre 2 y 6 opciones, sin repetir, y cierre futuro de hasta 60 días', async () => {
  const crear = (extra) => t.api.post('/encuestas', encuesta(extra), { token: autora.token });
  assert.equal((await crear({ opciones: ['Sola'] })).status, 400);
  assert.equal((await crear({ opciones: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })).status, 400);
  assert.equal((await crear({ opciones: ['Sí', 'sí'] })).status, 400);
  assert.equal((await crear({ opciones: ['Sí', ' '] })).status, 400);
  assert.equal((await crear({ cierra_en: enFuturo(-1) })).status, 400);
  assert.equal((await crear({ cierra_en: enFuturo(90) })).status, 400);
  assert.equal((await crear({ cierra_en: undefined })).status, 400);
});

test('antes de votar no se ven los resultados; la autora sí', async () => {
  assert.equal((await ver(ana)).body.encuesta.votos, null);
  assert.equal((await ver()).body.encuesta.votos, null, 'sin sesión tampoco');
  assert.deepEqual((await ver(autora)).body.encuesta.votos, [0, 0, 0]);
  const enListado = (await t.api.get('/encuestas')).body.encuestas.find((e) => e._id === id);
  assert.equal(enListado.votos, null);
});

test('votar cuenta, enseña los resultados a quien vota y se puede cambiar', async () => {
  const r = await votar(ana, 0);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.encuesta.votos, [1, 0, 0]);
  assert.equal(r.body.encuesta.mi_voto, 0);

  await votar(beto, 0);
  const cambio = await votar(ana, 2);
  assert.deepEqual(cambio.body.encuesta.votos, [1, 0, 1]);
  assert.equal(cambio.body.encuesta.total_votos, 2, 'cambiar no suma un voto más');

  assert.equal((await votar(ana, 2)).body.encuesta.total_votos, 2, 'repetir lo mismo no cambia nada');
});

test('dos votos a la vez de la misma persona cuentan uno', async () => {
  const carla = await t.crearUsuario();
  await Promise.all([votar(carla, 1), votar(carla, 1)]);
  const { total_votos: total, votos } = (await ver(autora)).body.encuesta;
  assert.equal(total, votos.reduce((a, b) => a + b, 0));
  assert.equal(total, await t.mongoose.model('VotoEncuesta').countDocuments({ post_id: id }));
});

test('nadie ve quién votó qué; cada uno ve solo su voto', async () => {
  const mios = (await t.api.get('/encuestas/mis-votos', { token: beto.token })).body.votos;
  assert.deepEqual(mios, { [id]: 0 });
  const r = await ver(autora);
  assert.equal(JSON.stringify(r.body).includes(beto.id), false);
});

test('una opción que no existe, 400; sin sesión, 401', async () => {
  assert.equal((await votar(ana, 7)).status, 400);
  assert.equal((await votar(ana, 'uno')).status, 400);
  assert.equal((await t.api.post(`/encuestas/${id}/votar`, { opcion: 0 })).status, 401);
});

test('cerrada: no admite votos y enseña el resultado a todos', async () => {
  await t.mongoose.model('EncuestaDetalle').updateOne({ post_id: id }, { cierra_en: new Date('2020-01-01') });
  const dani = await t.crearUsuario();
  assert.equal((await votar(dani, 0)).status, 409);
  const publica = (await ver()).body.encuesta;
  assert.equal(publica.abierta, false);
  assert.ok(Array.isArray(publica.votos));
});

test('al eliminar la cuenta, su voto se descuenta', async () => {
  const antes = (await ver(autora)).body.encuesta.total_votos;
  await t.api.delete('/usuarios/perfil', { token: ana.token, cuerpo: { contraseña: CONTRASEÑA } });
  assert.equal((await ver(autora)).body.encuesta.total_votos, antes - 1);
});
