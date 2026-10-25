import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar } from './ayuda.js';

let t;
let publicador;
let duena;
let otro;
let admin;
let id;

const negocio = { titulo: 'Bar La Plaza', contenido: 'Tapas', categoria: 'restauracion', direccion: 'Plaza de España, 3', ubicacion: { lat: 37.2544, lng: -7.2032 } };
const enFuturo = (dias) => new Date(Date.now() + dias * 86400000).toISOString();
const delListado = async () => (await t.api.get('/negocios')).body.negocios.find((n) => n._id === id);

before(async () => {
  t = await arrancar();
  publicador = await t.crearUsuario();
  duena = await t.crearUsuario();
  otro = await t.crearUsuario();
  admin = await t.crearUsuario({ rol: 'admin' });
  id = (await t.api.post('/negocios', negocio, { token: publicador.token })).body.negocio._id;
});
after(() => t.detener());

test('sin propietario, gestiona la ficha quien la publicó; otro vecino no', async () => {
  assert.equal((await t.api.patch(`/negocios/${id}/ficha`, { horario: 'L-S 8-23' }, { token: otro.token })).status, 403);
  const r = await t.api.patch(`/negocios/${id}/ficha`, { horario: 'L-S 8-23', telefono: '959 00 00 02' }, { token: publicador.token });
  assert.equal(r.status, 200);
  assert.equal(r.body.negocio.horario, 'L-S 8-23');
});

test('la ficha solo acepta sus campos', async () => {
  await t.api.patch(`/negocios/${id}/ficha`, { destacado_hasta: enFuturo(300), propietario_id: otro.id }, { token: publicador.token });
  const n = await delListado();
  assert.equal(n.destacado, false, 'no se puede destacar gratis por aquí');
  assert.equal(n.propietario_id, null, 'ni declararse propietario');
});

test('reclamar: pide prueba, una pendiente por persona, y la cola es solo del admin', async () => {
  assert.equal((await t.api.post(`/negocios/${id}/reclamar`, {}, { token: duena.token })).status, 400);
  assert.equal((await t.api.post(`/negocios/${id}/reclamar`, { mensaje: 'Soy la titular, CIF B123' }, { token: duena.token })).status, 201);
  assert.equal((await t.api.post(`/negocios/${id}/reclamar`, { mensaje: 'Otra vez' }, { token: duena.token })).status, 409);
  assert.equal((await t.api.post(`/negocios/${id}/reclamar`, { mensaje: 'Yo también' }, { token: otro.token })).status, 201);

  assert.equal((await t.api.get('/negocios/reclamaciones', { token: duena.token })).status, 403);
  const cola = (await t.api.get('/negocios/reclamaciones', { token: admin.token })).body.reclamaciones;
  assert.equal(cola.length, 2);
  assert.equal(cola[0].post_id.titulo, 'Bar La Plaza');
});

test('aceptar una reclamación da la ficha, rechaza las demás y avisa', async () => {
  const cola = (await t.api.get('/negocios/reclamaciones', { token: admin.token })).body.reclamaciones;
  const deLaDuena = cola.find((r) => r.usuario_id._id === duena.id);

  const r = await t.api.patch(`/negocios/reclamaciones/${deLaDuena._id}`, { estado: 'aceptada' }, { token: admin.token });
  assert.equal(r.status, 200);
  assert.equal((await t.api.patch(`/negocios/reclamaciones/${deLaDuena._id}`, { estado: 'rechazada' }, { token: admin.token })).status, 409);

  assert.equal((await delListado()).propietario_id, duena.id);
  assert.equal((await t.api.get('/negocios/reclamaciones', { token: admin.token })).body.reclamaciones.length, 0, 'la otra queda rechazada');

  const avisos = (await t.api.get('/notificaciones', { token: duena.token })).body.notificaciones;
  assert.ok(avisos.some((n) => n.tipo === 'reclamacion_negocio' && /Ya gestionas/.test(n.mensaje)));
});

test('con propietario, la gestiona él (y el admin), ya no quien la publicó', async () => {
  assert.equal((await t.api.patch(`/negocios/${id}/ficha`, { horario: 'cerrado' }, { token: publicador.token })).status, 403);
  assert.equal((await t.api.patch(`/negocios/${id}/ficha`, { horario: 'L-D 9-24' }, { token: duena.token })).status, 200);
  assert.equal((await t.api.patch(`/negocios/${id}/ficha`, { sitio_web: 'https://bar.example' }, { token: admin.token })).status, 200);
});

test('ofertas: futura, como mucho 90 días, se ve mientras vale y se quita sin texto', async () => {
  const poner = (cuerpo, quien = duena) => t.api.put(`/negocios/${id}/oferta`, cuerpo, { token: quien.token });

  assert.equal((await poner({ texto: '2x1', vigente_hasta: enFuturo(-1) })).status, 400);
  assert.equal((await poner({ texto: '2x1', vigente_hasta: enFuturo(120) })).status, 400);
  assert.equal((await poner({ texto: '2x1', vigente_hasta: enFuturo(3) }, otro)).status, 403);

  assert.equal((await poner({ texto: '2x1 en cafés', vigente_hasta: enFuturo(3) })).status, 200);
  assert.equal((await delListado()).oferta.texto, '2x1 en cafés');

  // Caducada: deja de viajar.
  await t.mongoose.model('NegocioDetalle').updateOne({ post_id: id }, { 'oferta.vigente_hasta': new Date('2020-01-01') });
  assert.equal((await delListado()).oferta, null);

  await poner({ texto: 'Nueva', vigente_hasta: enFuturo(1) });
  assert.equal((await poner({ texto: '' })).status, 200);
  assert.equal((await delListado()).oferta, null);
});

test('el propietario no puede reclamar lo que ya es suyo', async () => {
  assert.equal((await t.api.post(`/negocios/${id}/reclamar`, { mensaje: 'Es mío' }, { token: duena.token })).status, 409);
});

test('"soy el propietario" al publicar abre una reclamación; la etiqueta llega al aceptarla', async () => {
  const sinPrueba = await t.api.post('/negocios', { ...negocio, titulo: 'Sin prueba', prueba_propiedad: '  ' }, { token: otro.token });
  assert.equal(sinPrueba.status, 400);
  assert.ok(!(await t.api.get('/negocios')).body.negocios.some((n) => n.titulo === 'Sin prueba'), 'no deja el negocio a medias');

  const r = await t.api.post('/negocios', { ...negocio, titulo: 'Taller Paco', prueba_propiedad: 'Llamad al 959 11 22 33 y preguntad por Paco' }, { token: otro.token });
  assert.equal(r.status, 201);
  assert.equal(r.body.reclamacion_pendiente, true);
  assert.equal(r.body.negocio.propietario_id ?? null, null, 'todavía no es propietario');
  const nuevo = r.body.negocio._id;

  assert.deepEqual((await t.api.get('/negocios/mis-reclamaciones', { token: otro.token })).body.negocios, [nuevo]);

  const cola = (await t.api.get('/negocios/reclamaciones', { token: admin.token })).body.reclamaciones;
  const suya = cola.find((x) => String(x.post_id._id) === nuevo);
  assert.equal(suya.es_quien_lo_publico, true);
  assert.equal(suya.negocio.direccion, negocio.direccion);

  assert.equal((await t.api.patch(`/negocios/reclamaciones/${suya._id}`, { estado: 'aceptada' }, { token: admin.token })).status, 200);
  const ficha = (await t.api.get('/negocios')).body.negocios.find((n) => n._id === nuevo);
  assert.equal(String(ficha.propietario_id), otro.id);
  assert.deepEqual((await t.api.get('/negocios/mis-reclamaciones', { token: otro.token })).body.negocios, []);
});

test('quien publicó un negocio sin marcarlo puede acreditarlo después', async () => {
  const r = await t.api.post('/negocios', { ...negocio, titulo: 'Mercería Ana' }, { token: duena.token });
  assert.equal(r.body.reclamacion_pendiente, false);
  const reclamar = await t.api.post(`/negocios/${r.body.negocio._id}/reclamar`, { mensaje: 'Tengo la licencia a mi nombre' }, { token: duena.token });
  assert.equal(reclamar.status, 201);
});
