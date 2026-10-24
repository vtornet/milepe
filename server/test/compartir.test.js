import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { arrancar, quejaValida } from './ayuda.js';
// Código del cliente (la edge function de Netlify), puro: se prueba aquí.
import { etiquetasDePublicacion, insertarEtiquetas, resumir } from '../../client/netlify/og-html.js';

const indexHtml = fs.readFileSync(new URL('../../client/index.html', import.meta.url), 'utf8');
const opciones = { urlPagina: 'https://milepe.com/p/abc', imagenPorDefecto: 'https://milepe.com/icons/compartir.png' };

test('resumir: una línea, cortada por palabra y con puntos suspensivos', () => {
  assert.equal(resumir('Hola\n\n  mundo'), 'Hola mundo');
  const largo = resumir('palabra '.repeat(60), 100);
  assert.ok(largo.length <= 101);
  assert.ok(largo.endsWith('…'));
  assert.ok(!largo.includes('  '));
});

test('sustituye título, descripción y etiquetas por defecto por las de la publicación', () => {
  const post = {
    titulo: 'Bache en la calle Real',
    contenido: 'Lleva meses así',
    imagenes: ['https://res.cloudinary.com/n/image/upload/v1/milepe/a.jpg'],
  };
  const html = insertarEtiquetas(indexHtml, etiquetasDePublicacion(post, opciones));

  assert.match(html, /<title>Bache en la calle Real · MiLepe<\/title>/);
  assert.match(html, /<meta property="og:title" content="Bache en la calle Real" \/>/);
  assert.match(html, /<meta name="description" content="Lleva meses así" \/>/);
  assert.match(html, /<meta property="og:image" content="https:\/\/res\.cloudinary\.com\/n\/image\/upload\/w_1200,c_limit\/v1\/milepe\/a\.jpg" \/>/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/);
  // Las por defecto ya no están: una sola og:title.
  assert.equal(html.match(/og:title/g).length, 1);
  assert.equal(html.includes('MiLepe, la red social de Lepe'), false);
});

test('sin imagen usa la de MiLepe; el HTML va escapado', () => {
  const html = insertarEtiquetas(indexHtml, etiquetasDePublicacion({ titulo: '"<script>" & más', contenido: 'x' }, opciones));
  assert.match(html, /og:image" content="https:\/\/milepe\.com\/icons\/compartir\.png"/);
  assert.match(html, /og:title" content="&quot;&lt;script&gt;&quot; &amp; más"/);
  assert.equal(html.includes('<script>" &'), false);
  assert.match(html, /<script type="module"/, 'el resto del HTML sigue intacto');
});

// --- API: lo que lee la edge function ---

let t;
let vecino;
let moderador;

before(async () => {
  t = await arrancar();
  vecino = await t.crearUsuario();
  moderador = await t.crearUsuario({ rol: 'moderador' });
});
after(() => t.detener());

test('GET /posts/:id solo da lo publicado: lo ocultado por moderación es 404', async () => {
  const id = (await t.api.post('/quejas', quejaValida(), { token: vecino.token })).body.queja._id;
  assert.equal((await t.api.get(`/posts/${id}`)).status, 200);

  await t.api.patch(`/posts/${id}/moderar`, { estado_moderacion: 'oculto' }, { token: moderador.token });
  assert.equal((await t.api.get(`/posts/${id}`)).status, 404);
});
