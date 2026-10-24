import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, quejaValida } from './ayuda.js';
import { extraerEtiquetas, MAX_ETIQUETAS } from '../src/utils/etiquetas.js';
import { trocearConEtiquetas } from '../../client/src/utils/etiquetas.js';

const CASOS = [
  '#Feria de #Lepe',
  'Fiesta (#FéRiA2026), ¿vienes?',
  'El #año que viene, no el #ano',
  'Ver milepe.com/#arriba y &#39; y ##doble',
  '#1 no es tema pero #1ºpremio sí',
  'Sin etiquetas aquí',
  '#a corta, #ab vale',
];

const delCliente = (texto) => [...new Set(trocearConEtiquetas(texto).filter((x) => x.etiqueta).map((x) => x.etiqueta))];

test('servidor y cliente encuentran las mismas etiquetas', () => {
  for (const texto of CASOS) assert.deepEqual(extraerEtiquetas(texto), delCliente(texto), texto);
  assert.deepEqual(extraerEtiquetas(CASOS[0]), ['feria', 'lepe']);
  assert.deepEqual(extraerEtiquetas(CASOS[1]), ['feria2026']);
  assert.deepEqual(extraerEtiquetas(CASOS[2]), ['año', 'ano']);
  assert.deepEqual(extraerEtiquetas(CASOS[3]), []);
  assert.deepEqual(extraerEtiquetas(CASOS[6]), ['ab']);
});

test('el cliente no pierde ni cambia el texto al trocearlo', () => {
  for (const texto of CASOS) {
    assert.equal(trocearConEtiquetas(texto).map((x) => x.texto ?? x.original).join(''), texto);
  }
});

test('como mucho MAX_ETIQUETAS por publicación', () => {
  const texto = Array.from({ length: 15 }, (_, i) => `#tema${i}`).join(' ');
  assert.equal(extraerEtiquetas(texto).length, MAX_ETIQUETAS);
});

let t;
let autor;
before(async () => {
  t = await arrancar();
  autor = await t.crearUsuario();
});
after(() => t.detener());

const publicar = async (extra) => (await t.api.post('/quejas', quejaValida(extra), { token: autor.token })).body.queja;

test('las etiquetas se guardan al publicar, se recalculan al editar y filtran el Muro', async () => {
  const a = await publicar({ titulo: 'Bache #CalleReal', contenido: 'Otra vez #obras', etiquetas: ['colada'] });
  await publicar({ contenido: 'Más #obras' });
  await publicar({ contenido: 'Nada que ver' });

  const deObras = await t.api.get('/posts?etiqueta=%23Obras');
  assert.equal(deObras.body.posts.length, 2);
  assert.deepEqual(deObras.body.posts.find((p) => p._id === a._id).etiquetas.sort(), ['callereal', 'obras'], 'no acepta las del cliente');

  await t.api.patch(`/posts/${a._id}`, { contenido: 'Arreglado, gracias #ayuntamiento' }, { token: autor.token });
  assert.equal((await t.api.get('/posts?etiqueta=obras')).body.posts.length, 1);
  assert.equal((await t.api.get('/posts?etiqueta=ayuntamiento')).body.posts.length, 1);
});

test('populares: solo las de dos o más publicaciones, la más usada primero', async () => {
  await publicar({ contenido: '#feria #obras' });
  const r = await t.api.get('/posts/etiquetas/populares');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.etiquetas, [{ etiqueta: 'obras', publicaciones: 2 }]);
});
