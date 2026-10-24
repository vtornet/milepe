// Varios moderadores a la vez: asignarse reportes y apelaciones, que nadie
// resuelva lo que tiene otro, y notas internas que no salen del equipo.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, quejaValida } from './ayuda.js';

let t;
let autor;
let vecinos;
let mod1;
let mod2;
let admin1;
let admin2;
let postId;
let reporteId;

before(async () => {
  t = await arrancar();
  autor = await t.crearUsuario();
  vecinos = [await t.crearUsuario(), await t.crearUsuario()];
  mod1 = await t.crearUsuario({ rol: 'moderador' });
  mod2 = await t.crearUsuario({ rol: 'moderador' });
  admin1 = await t.crearUsuario({ rol: 'admin' });
  admin2 = await t.crearUsuario({ rol: 'admin' });
  postId = (await t.api.post('/quejas', quejaValida(), { token: autor.token })).body.queja._id;
  for (const v of vecinos) {
    await t.api.post('/moderacion/reportes', { contenido_tipo: 'post', contenido_id: postId, motivo: 'spam' }, { token: v.token });
  }
  reporteId = (await t.api.get('/moderacion/reportes', { token: mod1.token })).body.reportes[0]._id;
});
after(() => t.detener());

const asignar = (quien, id, tomar, tipo = 'reportes') =>
  t.api.patch(`/moderacion/${tipo}/${id}/asignacion`, { tomar }, { token: quien.token });
const cola = async (quien, asignacion) =>
  (await t.api.get(`/moderacion/reportes${asignacion ? `?asignacion=${asignacion}` : ''}`, { token: quien.token })).body.reportes;

test('un moderador se queda un reporte; otro no puede quedárselo ni resolverlo', async () => {
  const r = await asignar(mod1, reporteId, true);
  assert.equal(r.status, 200);
  assert.equal(r.body.asignado_a._id, mod1.id);
  assert.ok(new Date(r.body.asignado_hasta) > new Date(Date.now() + 23 * 3600 * 1000), 'caduca en 24 h');

  assert.equal((await asignar(mod2, reporteId, true)).status, 409);
  const resolver = await t.api.patch(`/moderacion/reportes/${reporteId}`, { estado: 'rechazado' }, { token: mod2.token });
  assert.equal(resolver.status, 409);

  assert.deepEqual((await cola(mod1, 'mias')).map((x) => x._id), [reporteId]);
  assert.equal((await cola(mod2, 'mias')).length, 0);
  assert.ok(!(await cola(mod2, 'libres')).some((x) => x._id === reporteId));
  assert.equal((await t.api.get('/moderacion/reportes?asignacion=raro', { token: mod1.token })).status, 400);
});

test('soltar: quien lo tiene o un admin; otro moderador no', async () => {
  assert.equal((await asignar(mod2, reporteId, false)).status, 403);
  assert.equal((await asignar(admin1, reporteId, false)).status, 200);
  assert.ok((await cola(mod2, 'libres')).some((x) => x._id === reporteId));
});

test('dos que lo toman a la vez: solo uno se lo queda', async () => {
  const [a, b] = await Promise.all([asignar(mod1, reporteId, true), asignar(mod2, reporteId, true)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const ganador = a.status === 200 ? mod1 : mod2;
  await asignar(ganador, reporteId, false);
});

test('una asignación caducada deja el reporte libre', async () => {
  await asignar(mod1, reporteId, true);
  const { default: Reporte } = await import('../src/models/Reporte.js');
  await Reporte.updateOne({ _id: reporteId }, { asignado_hasta: new Date(Date.now() - 1000) });
  assert.ok((await cola(mod2, 'libres')).some((x) => x._id === reporteId));
  assert.equal((await asignar(mod2, reporteId, true)).status, 200);
  // Y quien lo tiene ahora lo resuelve.
  const r = await t.api.patch(`/moderacion/reportes/${reporteId}`, { estado: 'aceptado', accion: 'ocultar', nota: 'spam' }, { token: mod2.token });
  assert.equal(r.status, 200);
  assert.equal((await asignar(mod1, reporteId, true)).status, 409, 'lo resuelto ya no se asigna');
});

test('apelación: no se la queda quien tomó la decisión; la toma otro admin', async () => {
  // admin1 retira la publicación (la decisión), el autor apela.
  const otra = (await t.api.post('/quejas', quejaValida({ titulo: 'Otra' }), { token: autor.token })).body.queja._id;
  await t.api.patch('/moderacion/contenido', { contenido_tipo: 'post', contenido_id: otra, estado_moderacion: 'oculto', nota: 'x' }, { token: admin1.token });
  const ap = await t.api.post('/moderacion/apelaciones', { contenido_tipo: 'post', contenido_id: otra, texto: 'No era spam' }, { token: autor.token });
  assert.equal(ap.status, 201, JSON.stringify(ap.body));
  const id = ap.body.apelacion._id;

  assert.equal((await asignar(admin1, id, true, 'apelaciones')).status, 403);
  assert.equal((await asignar(mod1, id, true, 'apelaciones')).status, 403, 'un moderador no toma apelaciones');
  assert.equal((await asignar(admin2, id, true, 'apelaciones')).status, 200);
  const resuelta = await t.api.patch(`/moderacion/apelaciones/${id}`, { estado: 'aceptada', respuesta: 'Tienes razón' }, { token: admin2.token });
  assert.equal(resuelta.status, 200);
});

test('notas internas: el equipo las escribe y lee; el autor no las ve en ningún sitio', async () => {
  const nota = await t.api.post('/moderacion/notas', { contenido_tipo: 'post', contenido_id: postId, texto: 'Tercera vez que publica esto' }, { token: mod1.token });
  assert.equal(nota.status, 201);
  await t.api.post('/moderacion/notas', { contenido_tipo: 'post', contenido_id: postId, texto: 'Le escribo por privado' }, { token: mod2.token });

  const lista = await t.api.get(`/moderacion/notas?contenido_tipo=post&contenido_id=${postId}`, { token: admin1.token });
  assert.deepEqual(lista.body.notas.map((n) => n.texto), ['Tercera vez que publica esto', 'Le escribo por privado']);
  assert.ok(lista.body.notas.every((n) => n.autor_id.nombre_usuario && !n.autor_id.email));

  assert.equal((await t.api.get(`/moderacion/notas?contenido_tipo=post&contenido_id=${postId}`, { token: autor.token })).status, 403);
  assert.equal((await t.api.post('/moderacion/notas', { contenido_tipo: 'post', contenido_id: postId, texto: 'x' }, { token: autor.token })).status, 403);
  const suyo = await t.api.get('/moderacion/mi-contenido-moderado', { token: autor.token });
  assert.ok(!JSON.stringify(suyo.body).includes('Tercera vez'), 'no viaja en mi-contenido-moderado');

  assert.equal((await t.api.post('/moderacion/notas', { contenido_tipo: 'post', contenido_id: '0'.repeat(24), texto: 'x' }, { token: mod1.token })).status, 404);
  assert.equal((await t.api.post('/moderacion/notas', { contenido_tipo: 'raro', contenido_id: postId, texto: 'x' }, { token: mod1.token })).status, 400);
});

test('las notas son de solo añadir', async () => {
  const { default: NotaModeracion } = await import('../src/models/NotaModeracion.js');
  const nota = await NotaModeracion.findOne();
  nota.texto = 'cambiada';
  await assert.rejects(nota.save(), /no se modifican/);
  await assert.rejects(NotaModeracion.deleteMany({}), /no se modifican/);
  assert.ok((await NotaModeracion.countDocuments()) >= 2);
});
