import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { arrancar } from './ayuda.js';
// Código del cliente (la edge function de Netlify), puro: se prueba aquí.
import { PAGINAS_SEO, paginaDeRuta, paginaDePublicacion, insertarPagina } from '../../client/netlify/seo-html.js';

const indexHtml = fs.readFileSync(new URL('../../client/index.html', import.meta.url), 'utf8');
const ORIGEN = 'https://milepe.com';
const raiz = (html) => html.match(/<div id="root">([\s\S]*)<\/div>\s*<script/)?.[1] ?? html.match(/<div id="root">([\s\S]*?)<\/div>\s*<\/body>/)?.[1];
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test('las rutas de la edge function son exactamente las de PAGINAS_SEO, más /p/*', () => {
  const fuente = fs.readFileSync(new URL('../../client/netlify/edge-functions/seo.js', import.meta.url), 'utf8');
  const bloque = fuente.match(/path: \[([\s\S]*?)\]/)[1];
  const rutas = [...bloque.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(rutas.sort(), ['/p/*', ...Object.keys(PAGINAS_SEO)].sort());
});

test('una ruta que no es pública no se toca', () => {
  assert.equal(paginaDeRuta('/mensajes', null, ORIGEN), null);
  assert.equal(paginaDeRuta('/turismo/inventada', null, ORIGEN), null);
});

test('una sección sin datos lleva título, descripción, canónica, contenido y navegación', () => {
  const html = insertarPagina(indexHtml, paginaDeRuta('/farmacias', null, ORIGEN));
  assert.match(html, /<title>Farmacias de guardia · MiLepe<\/title>/);
  assert.match(html, /<meta name="description" content="Farmacias de guardia en Lepe/);
  assert.match(html, /<link rel="canonical" href="https:\/\/milepe\.com\/farmacias" \/>/);
  assert.equal(html.match(/og:title/g).length, 1);
  const contenido = raiz(html);
  assert.match(contenido, /<h1>Farmacias de guardia<\/h1>/);
  assert.match(contenido, /<a href="\/turismo">Turismo<\/a>/);
  // El script de la app sigue ahí: React arranca y sustituye el contenido.
  assert.match(html, /<script type="module"/);
});

test('eventos: lista en HTML y Event de schema.org, con el texto escapado', () => {
  const datos = {
    eventos: [
      {
        _id: 'a1',
        titulo: 'Feria </script><b>',
        contenido: 'Casetas y música',
        fecha_inicio: '2099-08-15T18:00:00.000Z',
        lugar: 'Recinto ferial',
        ubicacion: { lat: 37.25, lng: -7.2 },
        imagenes: [],
      },
    ],
  };
  const html = insertarPagina(indexHtml, paginaDeRuta('/eventos', datos, ORIGEN));
  const contenido = raiz(html);
  assert.match(contenido, /<a href="\/p\/a1">Feria &lt;\/script&gt;&lt;b&gt;<\/a>/);
  assert.match(contenido, /Recinto ferial/);
  assert.ok(!html.includes('</script><b>'), 'ni en el HTML ni en el JSON-LD se cierra el script');

  const [evento] = jsonLd(html);
  assert.equal(evento['@type'], 'Event');
  assert.equal(evento.name, 'Feria </script><b>');
  assert.equal(evento.startDate, '2099-08-15T18:00:00.000Z');
  assert.equal(evento.location.name, 'Recinto ferial');
  assert.equal(evento.location.geo.latitude, 37.25);
  assert.equal(evento.url, 'https://milepe.com/p/a1');
  assert.ok(!('endDate' in evento) && !('image' in evento), 'sin campos vacíos');
});

test('turismo: el índice enlaza las siete secciones y cada una describe sus lugares', () => {
  const indice = raiz(insertarPagina(indexHtml, paginaDeRuta('/turismo', null, ORIGEN)));
  assert.equal(indice.match(/href="\/turismo\/[a-z_]+"/g).length, 7);

  const recursos = [{ titulo: 'Playa de La Antilla', descripcion: 'Arena fina', direccion: 'La Antilla', web: 'https://ejemplo.es' }];
  const html = insertarPagina(indexHtml, paginaDeRuta('/turismo/sol_y_playa', { recursos }, ORIGEN));
  assert.match(html, /<title>Sol y playa · Turismo en Lepe · MiLepe<\/title>/);
  assert.match(raiz(html), /<h2>Playa de La Antilla<\/h2><p>La Antilla<\/p><p>Arena fina<\/p>/);
  const [lugar] = jsonLd(html);
  assert.equal(lugar['@type'], 'TouristAttraction');
  assert.equal(lugar.address.streetAddress, 'La Antilla');
  assert.equal(lugar.address.addressLocality, 'Lepe');
});

test('una publicación: etiquetas de compartir y su texto por párrafos', () => {
  const post = { _id: 'b2', titulo: 'Bache', contenido: 'Uno\n\nDos', autor_id: { nombre_usuario: 'ana' }, imagenes: [] };
  const html = insertarPagina(indexHtml, paginaDePublicacion(post, ORIGEN));
  assert.match(html, /<link rel="canonical" href="https:\/\/milepe\.com\/p\/b2" \/>/);
  assert.match(html, /og:type" content="article"/);
  assert.match(raiz(html), /<h1>Bache<\/h1><p>Publicado por ana<\/p><p>Uno<\/p><p>Dos<\/p>/);
});

// Con la API de verdad: la forma de los listados que lee la edge function.
let t;
before(async () => {
  t = await arrancar();
});
after(() => t.detener());

test('lee bien los listados reales de eventos, negocios y contactos', async () => {
  const vecino = await t.crearUsuario();
  await t.api.post(
    '/eventos',
    { titulo: 'Concierto', contenido: 'En la plaza', categoria: 'concierto', lugar: 'Plaza de España', fecha_inicio: '2099-07-01T20:00:00Z' },
    { token: vecino.token },
  );
  await t.api.post(
    '/negocios',
    { titulo: 'Bar Pepe', contenido: 'Tapas', categoria: 'restauracion', direccion: 'Calle Real, 1', telefono: '959000000', ubicacion: { lat: 37.25, lng: -7.2 } },
    { token: vecino.token },
  );

  for (const [ruta, esperado, tipo] of [
    ['/eventos', 'Concierto', 'Event'],
    ['/negocios', 'Bar Pepe', 'LocalBusiness'],
  ]) {
    const datos = (await t.api.get(PAGINAS_SEO[ruta].api)).body;
    const html = insertarPagina(indexHtml, paginaDeRuta(ruta, datos, ORIGEN));
    assert.match(raiz(html), new RegExp(esperado));
    assert.equal(jsonLd(html)[0]['@type'], tipo);
  }
  const negocio = jsonLd(insertarPagina(indexHtml, paginaDeRuta('/negocios', (await t.api.get('/negocios?limite=50')).body, ORIGEN)))[0];
  assert.equal(negocio.telephone, '959000000');
  assert.equal(negocio.geo.longitude, -7.2);

  const contactos = (await t.api.get(PAGINAS_SEO['/contactos'].api)).body;
  assert.ok(Array.isArray(contactos.contactos));
});

test('sitemap.xml: las secciones, los grupos y lo publicado, nada oculto', async () => {
  const autor = await t.crearUsuario();
  const moderador = await t.crearUsuario({ rol: 'moderador' });
  const visible = (await t.api.post('/quejas', { titulo: 'Visible', contenido: 'x', categoria: 'obras', ubicacion: { lat: 37.25, lng: -7.2 } }, { token: autor.token })).body.queja._id;
  const oculta = (await t.api.post('/quejas', { titulo: 'Oculta', contenido: 'x', categoria: 'obras', ubicacion: { lat: 37.25, lng: -7.2 } }, { token: autor.token })).body.queja._id;
  await t.api.patch(`/posts/${oculta}/moderar`, { estado_moderacion: 'oculto', motivo: 'prueba' }, { token: moderador.token });
  const grupo = (await t.api.post('/grupos', { nombre: 'AA.VV. El Molino', descripcion: 'Barrio', categoria: 'barrio' }, { token: autor.token })).body.grupo._id;

  const r = await fetch(`${t.base}/sitemap.xml`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /application\/xml/);
  const xml = await r.text();
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset /);
  for (const ruta of Object.keys(PAGINAS_SEO)) assert.ok(xml.includes(`<loc>https://milepe.com${ruta}</loc>`), ruta);
  assert.ok(xml.includes(`<loc>https://milepe.com/p/${visible}</loc><lastmod>`));
  assert.ok(!xml.includes(oculta), 'lo oculto no se anuncia');
  assert.ok(xml.includes(`<loc>https://milepe.com/grupos/${grupo}</loc>`));
});
