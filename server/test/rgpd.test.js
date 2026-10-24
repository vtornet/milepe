import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, CONTRASEÑA, quejaValida } from './ayuda.js';
import { idPublicoDeCloudinary } from '../src/utils/datosPersonales.js';

let t;
let ana;
let beto;
let admin;
let postAna;
let postBeto;

before(async () => {
  t = await arrancar();
  ana = await t.crearUsuario();
  beto = await t.crearUsuario();
  admin = await t.crearUsuario({ rol: 'admin' });

  // Ana tiene de todo: publicación, comentario, reacción, seguimientos,
  // bloqueo y una conversación con Beto.
  postAna = (await t.api.post('/quejas', quejaValida({ titulo: 'Queja de Ana' }), { token: ana.token })).body.queja._id;
  postBeto = (await t.api.post('/quejas', quejaValida({ titulo: 'Queja de Beto' }), { token: beto.token })).body.queja._id;
  await t.api.post(`/posts/${postBeto}/comentarios`, { texto: 'Comentario de Ana' }, { token: ana.token });
  await t.api.post(`/posts/${postBeto}/reaccion`, { tipo: 'apoyo' }, { token: ana.token });
  await t.api.post(`/seguimientos/${beto.id}`, {}, { token: ana.token });
  await t.api.post(`/seguimientos/${ana.id}`, {}, { token: beto.token });
  const conv = (await t.api.post(`/conversaciones/con/${beto.id}`, {}, { token: ana.token })).body.conversacion._id;
  await t.api.post(`/conversaciones/${conv}/mensajes`, { texto: 'Hola Beto' }, { token: ana.token });
  await t.api.post(`/conversaciones/${conv}/mensajes`, { texto: 'Hola Ana' }, { token: beto.token });
});
after(() => t.detener());

test('exportar mis datos: todo lo mío, como descarga, y sin el hash de la contraseña', async () => {
  const r = await t.api.get('/usuarios/perfil/exportar', { token: ana.token });
  assert.equal(r.status, 200);
  assert.match(r.cabeceras.get('content-disposition'), /attachment; filename="milepe-mis-datos-/);

  const d = r.body;
  assert.equal(d.perfil.email, ana.usuario.email);
  assert.equal(d.perfil.nombre, 'Nombre', 'incluye el nombre real: es suyo');
  assert.equal('contraseña' in d.perfil, false);
  assert.equal(d.publicaciones.length, 1);
  assert.equal(d.publicaciones[0].detalle.categoria, 'obras', 'con los datos de su sección');
  assert.equal(d.comentarios[0].texto, 'Comentario de Ana');
  assert.equal(d.reacciones[0].tipo, 'apoyo');
  assert.deepEqual(d.siguiendo.map((s) => s.usuario), [beto.usuario.nombre_usuario]);
  assert.deepEqual(d.conversaciones[0].mensajes.map((m) => [m.de, m.texto]), [
    ['yo', 'Hola Beto'],
    [beto.usuario.nombre_usuario, 'Hola Ana'],
  ]);
});

test('sin sesión no se exporta ni se elimina nada', async () => {
  assert.equal((await t.api.get('/usuarios/perfil/exportar')).status, 401);
  assert.equal((await t.api.delete('/usuarios/perfil')).status, 401);
});

test('eliminar exige la contraseña correcta', async () => {
  assert.equal((await t.api.delete('/usuarios/perfil', { token: ana.token })).status, 403);
  const r = await t.api.post('/auth/login', { email: ana.usuario.email, contraseña: CONTRASEÑA });
  assert.equal(r.status, 200, 'una contraseña mala no ha borrado nada');
});

// La baja necesita cuerpo (la contraseña o la confirmación).
const darDeBaja = (quien, cuerpo) => t.api.delete('/usuarios/perfil', { token: quien.token, cuerpo });

test('el último admin no puede eliminarse', async () => {
  const r = await darDeBaja(admin, { contraseña: CONTRASEÑA });
  assert.equal(r.status, 409);
});

test('eliminar la cuenta: anonimiza, retira lo publicado y limpia lo demás', async () => {
  const r = await darDeBaja(ana, { contraseña: CONTRASEÑA });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.eliminado, { publicaciones: 1, comentarios: 1, reacciones: 1, imagenes: 0 });

  // No puede volver a entrar.
  assert.equal((await t.api.post('/auth/login', { email: ana.usuario.email, contraseña: CONTRASEÑA })).status, 401);
  assert.equal((await t.api.get('/auth/perfil', { token: ana.token })).status, 401, 'su token deja de valer');

  // Su queja desaparece; la de Beto sigue, con el contador de apoyos devuelto a 0.
  const muro = (await t.api.get('/posts')).body.posts;
  assert.equal(muro.some((p) => p._id === postAna), false);
  const deBeto = muro.find((p) => p._id === postBeto);
  assert.equal(deBeto.reacciones_resumen.apoyo ?? 0, 0);
  assert.equal(deBeto.num_comentarios, 0);

  // Su comentario queda como hueco, sin texto ni autor.
  const comentarios = (await t.api.get(`/posts/${postBeto}/comentarios`)).body.comentarios;
  assert.equal(comentarios[0].retirado, 'autor');
  assert.equal(JSON.stringify(comentarios).includes('Comentario de Ana'), false);

  // En la base no queda ni el nombre real, ni el correo, ni el nombre de usuario.
  const Usuario = t.mongoose.model('Usuario');
  const doc = await Usuario.findById(ana.id).select('+nombre +apellidos').lean();
  assert.equal(doc.activo, false);
  assert.equal(doc.nombre, 'Cuenta eliminada');
  assert.equal(doc.apellidos, '');
  assert.match(doc.email, /^eliminado-.*@milepe\.invalid$/);
  assert.match(doc.nombre_usuario, /^vecino-eliminado-/);

  // Seguimientos borrados en los dos sentidos; la conversación sigue para Beto.
  assert.equal(await t.mongoose.model('Seguimiento').countDocuments({ $or: [{ seguidor_id: ana.id }, { seguido_id: ana.id }] }), 0);
  const bandeja = (await t.api.get('/conversaciones', { token: beto.token })).body.conversaciones;
  assert.equal(bandeja.length, 1, 'Beto conserva su conversación');
});

test('una cuenta de Google se confirma escribiendo ELIMINAR', async () => {
  const google = await t.crearUsuario({ google_id: 'google-123' });
  await t.mongoose.model('Usuario').updateOne({ _id: google.id }, { $unset: { contraseña: 1 } });

  assert.equal((await darDeBaja(google, { confirmacion: 'borrar' })).status, 400);
  assert.equal((await darDeBaja(google, { confirmacion: 'ELIMINAR' })).status, 200);
});

test('idPublicoDeCloudinary solo reconoce imágenes nuestras', () => {
  assert.equal(idPublicoDeCloudinary('https://res.cloudinary.com/nube/image/upload/v1712/milepe/abc123.jpg'), 'milepe/abc123');
  assert.equal(idPublicoDeCloudinary('https://res.cloudinary.com/nube/image/upload/milepe/turismo/x.png'), 'milepe/turismo/x');
  assert.equal(idPublicoDeCloudinary('https://res.cloudinary.com/nube/image/upload/w_400/v1/milepe/a.webp'), 'milepe/a');
  assert.equal(idPublicoDeCloudinary('https://lh3.googleusercontent.com/a/foto'), null);
  assert.equal(idPublicoDeCloudinary(null), null);
});
