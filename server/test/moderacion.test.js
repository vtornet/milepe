import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, quejaValida } from './ayuda.js';

let t;
let autor;
let moderador;
let admin;
let otroAdmin;

before(async () => {
  t = await arrancar();
  autor = await t.crearUsuario();
  moderador = await t.crearUsuario({ rol: 'moderador' });
  admin = await t.crearUsuario({ rol: 'admin' });
  otroAdmin = await t.crearUsuario({ rol: 'admin' });
});
after(() => t.detener());

const crear = async () => {
  const r = await t.api.post('/quejas', quejaValida(), { token: autor.token });
  return r.body.queja._id;
};

const enElMuro = async (id) => (await t.api.get('/posts')).body.posts.some((p) => p._id === id);

const reportar = (id, quien, motivo = 'spam') =>
  t.api.post('/moderacion/reportes', { contenido_tipo: 'post', contenido_id: id, motivo }, { token: quien.token });

const registroDe = async (id) =>
  (await t.api.get(`/moderacion/registro?contenido_id=${id}`, { token: admin.token })).body.registro;

test('tres reportes pendientes ocultan el contenido y dejan constancia en el registro', async () => {
  const id = await crear();
  const reportantes = [await t.crearUsuario(), await t.crearUsuario(), await t.crearUsuario()];

  assert.equal((await reportar(id, reportantes[0])).body.contenido_oculto, false);
  assert.equal((await reportar(id, reportantes[1])).body.contenido_oculto, false);
  assert.ok(await enElMuro(id));

  assert.equal((await reportar(id, reportantes[2])).body.contenido_oculto, true);
  assert.equal(await enElMuro(id), false);

  const registro = await registroDe(id);
  assert.equal(registro.length, 1);
  assert.equal(registro[0].accion, 'auto_ocultar');
  assert.equal(registro[0].moderador_id, null, 'lo hizo el umbral, no una persona');
});

test('no se puede reportar dos veces lo mismo ni lo propio', async () => {
  const id = await crear();
  const vecino = await t.crearUsuario();

  assert.equal((await reportar(id, vecino)).status, 201);
  assert.equal((await reportar(id, vecino)).status, 409);
  assert.equal((await reportar(id, autor)).status, 400);
});

test('un motivo de reporte fuera de la lista se rechaza', async () => {
  const id = await crear();
  const vecino = await t.crearUsuario();
  assert.equal((await reportar(id, vecino, 'porque_si')).status, 400);
});

test('descartar el último reporte pendiente republica lo que el umbral había ocultado', async () => {
  const id = await crear();
  const reportantes = [await t.crearUsuario(), await t.crearUsuario(), await t.crearUsuario()];
  const reportes = [];
  for (const r of reportantes) reportes.push((await reportar(id, r)).body.reporte);
  assert.equal(await enElMuro(id), false);

  for (const reporte of reportes) {
    const r = await t.api.patch(
      `/moderacion/reportes/${reporte._id}`,
      { estado: 'rechazado' },
      { token: moderador.token },
    );
    assert.equal(r.status, 200);
  }
  assert.equal(await enElMuro(id), true);
});

test('un vecino normal no puede moderar ni ver la cola', async () => {
  const id = await crear();
  const vecino = await t.crearUsuario();

  const moderar = await t.api.patch(`/posts/${id}/moderar`, { estado_moderacion: 'oculto' }, { token: vecino.token });
  assert.equal(moderar.status, 403);
  assert.equal((await t.api.get('/moderacion/reportes', { token: vecino.token })).status, 403);
  assert.equal((await t.api.get('/moderacion/registro', { token: vecino.token })).status, 403);
});

test('moderar escribe el registro, avisa al autor y no le dice qué moderador fue', async () => {
  const id = await crear();

  const r = await t.api.patch(
    `/posts/${id}/moderar`,
    { estado_moderacion: 'oculto', nota: 'Insultos' },
    { token: moderador.token },
  );
  assert.equal(r.status, 200);
  assert.equal(await enElMuro(id), false);

  const registro = await registroDe(id);
  assert.equal(registro[0].nota, 'Insultos');

  const propio = await t.api.get('/moderacion/mi-contenido-moderado', { token: autor.token });
  const fila = propio.body.contenido.find((c) => String(c.contenido._id) === id);
  assert.equal(fila.ultima_accion.nota, 'Insultos');
  assert.equal('moderador_id' in fila.ultima_accion, false);
});

// --- Apelaciones ---

test('solo el autor apela, y solo lo que no está visible', async () => {
  const visible = await crear();
  const oculto = await crear();
  await t.api.patch(`/posts/${oculto}/moderar`, { estado_moderacion: 'oculto' }, { token: moderador.token });
  const ajeno = await t.crearUsuario();

  const apelar = (id, quien) =>
    t.api.post(
      '/moderacion/apelaciones',
      { contenido_tipo: 'post', contenido_id: id, texto: 'Fue un error' },
      { token: quien.token },
    );

  assert.equal((await apelar(visible, autor)).status, 400);
  assert.equal((await apelar(oculto, ajeno)).status, 403);
  assert.equal((await apelar(oculto, autor)).status, 201);
  assert.equal((await apelar(oculto, autor)).status, 409, 'la resolución es definitiva: una sola apelación');
});

test('las apelaciones las resuelve un admin, nunca el moderador, y nadie contra su propia decisión', async () => {
  const id = await crear();
  await t.api.patch(`/posts/${id}/moderar`, { estado_moderacion: 'oculto' }, { token: admin.token });
  const apelacion = await t.api.post(
    '/moderacion/apelaciones',
    { contenido_tipo: 'post', contenido_id: id, texto: 'Revisadlo' },
    { token: autor.token },
  );
  const apelacionId = apelacion.body.apelacion._id;
  const resolver = (quien) =>
    t.api.patch(
      `/moderacion/apelaciones/${apelacionId}`,
      { estado: 'aceptada', respuesta: 'Tiene razón' },
      { token: quien.token },
    );

  assert.equal((await resolver(moderador)).status, 403, 'un moderador no resuelve apelaciones');
  assert.equal((await resolver(admin)).status, 403, 'el admin que ocultó no se revisa a sí mismo');
  assert.equal((await resolver(otroAdmin)).status, 200);
  assert.equal(await enElMuro(id), true);
});

test('aceptar una apelación descarta los reportes pendientes para que no vuelva a ocultarse', async () => {
  const id = await crear();
  const reportantes = [await t.crearUsuario(), await t.crearUsuario(), await t.crearUsuario()];
  for (const r of reportantes) await reportar(id, r);
  assert.equal(await enElMuro(id), false);

  const apelacion = await t.api.post(
    '/moderacion/apelaciones',
    { contenido_tipo: 'post', contenido_id: id, texto: 'No hice nada' },
    { token: autor.token },
  );
  await t.api.patch(
    `/moderacion/apelaciones/${apelacion.body.apelacion._id}`,
    { estado: 'aceptada', respuesta: 'Correcto' },
    { token: admin.token },
  );
  assert.equal(await enElMuro(id), true);

  const pendientes = await t.api.get('/moderacion/reportes', { token: admin.token });
  assert.equal(pendientes.body.reportes.some((r) => String(r.contenido_id) === id), false);
});

// --- El registro es solo de añadir ---

test('el registro de auditoría no se puede modificar ni borrar', async () => {
  const id = await crear();
  await t.api.patch(`/posts/${id}/moderar`, { estado_moderacion: 'oculto' }, { token: moderador.token });

  const RegistroModeracion = t.mongoose.model('RegistroModeracion');
  const entrada = await RegistroModeracion.findOne({ contenido_id: id });

  entrada.nota = 'manipulada';
  await assert.rejects(() => entrada.save());
  await assert.rejects(() => RegistroModeracion.updateOne({ _id: entrada._id }, { nota: 'x' }));
  await assert.rejects(() => RegistroModeracion.deleteOne({ _id: entrada._id }));
});
