// Los listados de sección que son agregaciones (Negocios, Eventos, Empleo,
// Quejas) y las estadísticas del admin: hasta ahora solo se habían probado
// a mano.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, quejaValida } from './ayuda.js';

let t;
let vecino;
let moderador;
let admin;
let modelos;

const DIA = 86400000;
const enDias = (n) => new Date(Date.now() + n * DIA).toISOString();

before(async () => {
  t = await arrancar();
  vecino = await t.crearUsuario();
  moderador = await t.crearUsuario({ rol: 'moderador' });
  admin = await t.crearUsuario({ rol: 'admin' });
  modelos = {
    Post: (await import('../src/models/Post.js')).default,
    NegocioDetalle: (await import('../src/models/NegocioDetalle.js')).default,
    EventoDetalle: (await import('../src/models/EventoDetalle.js')).default,
    EmpleoDetalle: (await import('../src/models/EmpleoDetalle.js')).default,
  };
});
after(() => t.detener());

const crear = async (ruta, cuerpo, clave) => {
  const r = await t.api.post(ruta, cuerpo, { token: vecino.token });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body[clave]._id;
};
const ocultar = (id) => t.api.patch(`/posts/${id}/moderar`, { estado_moderacion: 'oculto', motivo: 'prueba' }, { token: moderador.token });

test('Negocios: destacados primero; con lat/lng manda la distancia y radioKm recorta', async () => {
  const negocio = (titulo, lat, lng) => ({ titulo, contenido: 'x', categoria: 'comercio', direccion: 'Lepe', ubicacion: { lat, lng } });
  const cerca = await crear('/negocios', negocio('Cerca', 37.2545, -7.2033), 'negocio');
  const lejos = await crear('/negocios', negocio('Lejos', 37.21, -7.1), 'negocio');
  const oculto = await crear('/negocios', negocio('Oculto', 37.2546, -7.2034), 'negocio');
  await ocultar(oculto);
  await modelos.NegocioDetalle.updateOne({ post_id: lejos }, { destacado_hasta: new Date(Date.now() + DIA) });

  const sinGeo = (await t.api.get('/negocios')).body.negocios;
  assert.deepEqual(sinGeo.map((n) => n.titulo), ['Lejos', 'Cerca'], 'destacado primero, oculto fuera');
  assert.equal(sinGeo[0].destacado, true);

  const geo = (await t.api.get('/negocios?lat=37.2544&lng=-7.2032')).body.negocios;
  assert.deepEqual(geo.map((n) => n.titulo), ['Cerca', 'Lejos'], 'la distancia gana al destacado');
  assert.ok(geo[0].distancia_metros < geo[1].distancia_metros);

  const radio = (await t.api.get('/negocios?lat=37.2544&lng=-7.2032&radioKm=1')).body.negocios;
  assert.deepEqual(radio.map((n) => n._id), [cerca]);
  assert.equal((await t.api.get('/negocios?categoria=nada')).status, 400);
});

test('Eventos: próximos del más cercano al más lejano; los pasados, aparte y al revés', async () => {
  const evento = (titulo, dias) => ({ titulo, contenido: 'x', categoria: 'cultural', lugar: 'Lepe', fecha_inicio: enDias(dias) });
  await crear('/eventos', evento('En diez días', 10), 'evento');
  await crear('/eventos', evento('Mañana', 1), 'evento');
  const pasado = await crear('/eventos', evento('Pasado', 2), 'evento');
  const anterior = await crear('/eventos', evento('Más pasado', 3), 'evento');
  await modelos.EventoDetalle.updateOne({ post_id: pasado }, { fecha_inicio: new Date(Date.now() - 2 * DIA) });
  await modelos.EventoDetalle.updateOne({ post_id: anterior }, { fecha_inicio: new Date(Date.now() - 9 * DIA) });

  const proximos = (await t.api.get('/eventos')).body.eventos.map((e) => e.titulo);
  assert.deepEqual(proximos, ['Mañana', 'En diez días']);

  const todos = (await t.api.get('/eventos?incluirPasados=true')).body.eventos.map((e) => e.titulo);
  assert.deepEqual(todos, ['En diez días', 'Mañana', 'Pasado', 'Más pasado']);
});

test('Empleo: la modalidad es obligatoria y las ofertas caducadas no salen por defecto', async () => {
  assert.equal((await t.api.get('/empleo')).status, 400);
  const oferta = (puesto) => ({ titulo: puesto, contenido: 'x', modalidad: 'ofrezco', sector: 'agricola', puesto, jornal: 60 });
  await crear('/empleo', oferta('Recolector'), 'empleo');
  const caducada = await crear('/empleo', oferta('Envasador'), 'empleo');
  await crear('/empleo', { titulo: 'Busco campaña', contenido: 'x', modalidad: 'busco', sector: 'agricola', zona: 'Lepe' }, 'empleo');
  await modelos.EmpleoDetalle.updateOne({ post_id: caducada }, { estado_oferta: 'caducada' });

  const ofertas = (await t.api.get('/empleo?modalidad=ofrezco')).body.empleo.map((e) => e.titulo);
  assert.deepEqual(ofertas, ['Recolector']);
  assert.equal((await t.api.get('/empleo?modalidad=ofrezco&incluirCaducadas=true')).body.empleo.length, 2);
  assert.deepEqual((await t.api.get('/empleo?modalidad=busco')).body.empleo.map((e) => e.titulo), ['Busco campaña']);
});

test('Quejas: filtros por estado y categoría, lo oculto fuera', async () => {
  const a = await crear('/quejas', quejaValida({ titulo: 'Farola', categoria: 'limpieza' }), 'queja');
  await crear('/quejas', quejaValida({ titulo: 'Bache' }), 'queja');
  const oculta = await crear('/quejas', quejaValida({ titulo: 'Oculta' }), 'queja');
  await ocultar(oculta);
  await t.api.patch(`/quejas/${a}/estado`, { estado: 'resuelto' }, { token: moderador.token });

  const titulos = async (q) => (await t.api.get(`/quejas${q}`)).body.quejas.map((x) => x.titulo);
  assert.deepEqual(await titulos(''), ['Bache', 'Farola']);
  assert.deepEqual(await titulos('?estado=resuelto'), ['Farola']);
  assert.deepEqual(await titulos('?categoria=obras'), ['Bache']);
  assert.equal((await t.api.get('/quejas?estado=perdida')).status, 400);
});

test('Estadísticas: solo el admin; cuadran con lo creado y la serie no tiene huecos', async () => {
  assert.equal((await t.api.get('/estadisticas', { token: moderador.token })).status, 403);
  const r = await t.api.get('/estadisticas', { token: admin.token });
  assert.equal(r.status, 200);
  const e = r.body;

  assert.equal(e.usuarios.total, 3);
  assert.equal(e.usuarios.por_rol.admin, 1);
  assert.equal(e.contenido.posts_por_estado.oculto, 2);
  assert.equal(e.contenido.posts_publicados_por_tipo.negocio, 2);
  assert.equal(e.contenido.posts_publicados_por_tipo.queja, 2);
  assert.equal(e.secciones.negocios.destacados, 1);
  assert.equal(e.secciones.quejas.por_estado.resuelto, 1);

  const serie = e.contenido.serie_posts;
  assert.equal(serie.length, 30);
  assert.ok(serie.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.dia) && Number.isInteger(d.n)));
  const total = await modelos.Post.countDocuments({ estado_moderacion: 'publicado' });
  assert.equal(serie.reduce((s, d) => s + d.n, 0), total, 'todo lo publicado hoy cae en la serie (lo oculto no)');
  assert.equal(serie.at(-1).n, total, 'el último día es hoy');
});
