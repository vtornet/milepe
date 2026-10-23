import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, quejaValida } from './ayuda.js';

let t;
let autor;
let otro;
let admin;

before(async () => {
  t = await arrancar();
  autor = await t.crearUsuario();
  otro = await t.crearUsuario();
  admin = await t.crearUsuario({ rol: 'admin' });
});
after(() => t.detener());

const crear = async (quien = autor, extra = {}) => {
  const r = await t.api.post('/quejas', quejaValida(extra), { token: quien.token });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.queja._id;
};

const idsDelMuro = async () => (await t.api.get('/posts')).body.posts.map((p) => p._id);

test('una queja publicada aparece en el Muro', async () => {
  const id = await crear();
  assert.ok((await idsDelMuro()).includes(id));
});

test('una queja sin ubicación se rechaza y no deja un post huérfano', async () => {
  const antes = (await idsDelMuro()).length;
  const r = await t.api.post('/quejas', quejaValida({ ubicacion: undefined }), { token: autor.token });
  assert.equal(r.status, 400);
  assert.equal((await idsDelMuro()).length, antes);
});

// --- Editar ---

test('solo el autor puede editar su publicación', async () => {
  const id = await crear();

  const ajeno = await t.api.patch(`/posts/${id}`, { titulo: 'Cambiado' }, { token: otro.token });
  assert.equal(ajeno.status, 403);

  const propio = await t.api.patch(`/posts/${id}`, { titulo: 'Título nuevo' }, { token: autor.token });
  assert.equal(propio.status, 200);
  assert.equal(propio.body.post.titulo, 'Título nuevo');
  assert.equal(propio.body.post.editado, true);
});

test('ni un admin puede reescribir la publicación de otro', async () => {
  const id = await crear();
  const r = await t.api.patch(`/posts/${id}`, { titulo: 'Reescrito' }, { token: admin.token });
  assert.equal(r.status, 403);
});

test('editar el texto no manda a revisión; cambiar las imágenes sí, sin ocultarla', async () => {
  const id = await crear();

  const soloTexto = await t.api.patch(`/posts/${id}`, { contenido: 'Texto corregido' }, { token: autor.token });
  assert.equal(soloTexto.body.en_revision, false);

  const conFoto = await t.api.patch(
    `/posts/${id}`,
    { imagenes: ['https://res.cloudinary.com/x/foto.jpg'] },
    { token: autor.token },
  );
  assert.equal(conFoto.body.en_revision, true);
  assert.ok((await idsDelMuro()).includes(id), 'sigue visible mientras se revisa');
});

// --- Borrar ---

test('el autor borra su publicación: sale del Muro y no queda registro de moderación', async () => {
  const id = await crear();

  const r = await t.api.delete(`/posts/${id}`, { token: autor.token });
  assert.equal(r.status, 200);
  assert.equal((await idsDelMuro()).includes(id), false);

  const registro = await t.api.get(`/moderacion/registro?contenido_id=${id}`, { token: admin.token });
  assert.equal(registro.body.total, 0, 'borrar lo propio no es una acción de moderación');

  const avisos = await t.api.get('/notificaciones', { token: autor.token });
  assert.equal(avisos.body.notificaciones.length, 0, 'ni se avisa a sí mismo');
});

test('borrar dos veces no da error', async () => {
  const id = await crear();
  await t.api.delete(`/posts/${id}`, { token: autor.token });
  assert.equal((await t.api.delete(`/posts/${id}`, { token: autor.token })).status, 200);
});

test('un vecino no puede borrar la publicación de otro', async () => {
  const id = await crear();
  const r = await t.api.delete(`/posts/${id}`, { token: otro.token });
  assert.equal(r.status, 403);
  assert.ok((await idsDelMuro()).includes(id));
});

test('sin sesión no se borra nada', async () => {
  const id = await crear();
  assert.equal((await t.api.delete(`/posts/${id}`)).status, 401);
});

test('un admin borra la publicación de otro: queda en el registro y se avisa al autor', async () => {
  const id = await crear();

  const r = await t.api.delete(`/posts/${id}`, { token: admin.token });
  assert.equal(r.status, 200);
  assert.equal((await idsDelMuro()).includes(id), false);

  const registro = await t.api.get(`/moderacion/registro?contenido_id=${id}`, { token: admin.token });
  assert.equal(registro.body.total, 1);
  assert.equal(registro.body.registro[0].estado_nuevo, 'eliminado');

  const avisos = await t.api.get('/notificaciones', { token: autor.token });
  assert.ok(avisos.body.notificaciones.some((n) => String(n.referencia_id) === id));
});

test('lo que borras tú mismo no aparece en "Mi contenido" como si fuera una sanción', async () => {
  const propia = await crear();
  const sancionada = await crear();
  await t.api.delete(`/posts/${propia}`, { token: autor.token });
  await t.api.delete(`/posts/${sancionada}`, { token: admin.token });

  const r = await t.api.get('/moderacion/mi-contenido-moderado', { token: autor.token });
  const ids = r.body.contenido.map((c) => String(c.contenido._id));
  assert.equal(ids.includes(propia), false);
  assert.equal(ids.includes(sancionada), true);
});

test('una publicación borrada ya no se puede editar', async () => {
  const id = await crear();
  await t.api.delete(`/posts/${id}`, { token: autor.token });
  const r = await t.api.patch(`/posts/${id}`, { titulo: 'Zombi' }, { token: autor.token });
  assert.equal(r.status, 404);
});

// --- Comentarios ---

test('un comentario retirado deja un hueco sin texto ni autor en la respuesta', async () => {
  const id = await crear();
  const c = await t.api.post(`/posts/${id}/comentarios`, { texto: 'Un secreto' }, { token: otro.token });
  assert.equal(c.status, 201);
  const comentarioId = c.body.comentario._id;

  await t.api.delete(`/posts/${id}/comentarios/${comentarioId}`, { token: otro.token });

  const lista = await t.api.get(`/posts/${id}/comentarios`);
  const hueco = lista.body.comentarios.find((x) => x._id === comentarioId);
  assert.ok(hueco, 'la fila sigue, para no romper el hilo');
  assert.equal(hueco.retirado, 'autor');
  assert.equal('texto' in hueco, false);
  assert.equal('autor_id' in hueco, false);
  assert.equal(JSON.stringify(lista.body).includes('Un secreto'), false);
});

test('la profundidad de una respuesta la calcula el servidor, no el cliente', async () => {
  const id = await crear();
  const raiz = await t.api.post(`/posts/${id}/comentarios`, { texto: 'Raíz' }, { token: otro.token });
  const respuesta = await t.api.post(
    `/posts/${id}/comentarios`,
    { texto: 'Respuesta', padre_id: raiz.body.comentario._id, profundidad: 0 },
    { token: autor.token },
  );
  assert.equal(respuesta.status, 201);
  assert.equal(respuesta.body.comentario.profundidad, 1);
});

test('una respuesta no puede colgar de un comentario de otra publicación', async () => {
  const a = await crear();
  const b = await crear();
  const raiz = await t.api.post(`/posts/${a}/comentarios`, { texto: 'En A' }, { token: otro.token });
  const cruzada = await t.api.post(
    `/posts/${b}/comentarios`,
    { texto: 'En B', padre_id: raiz.body.comentario._id },
    { token: otro.token },
  );
  assert.ok(cruzada.status >= 400 && cruzada.status < 500);
});

// --- Reacciones ---

test('reaccionar dos veces con lo mismo la quita; con otra cosa la cambia', async () => {
  const id = await crear();
  const reaccionar = (tipo) => t.api.post(`/posts/${id}/reaccion`, { tipo }, { token: otro.token });

  const puesta = await reaccionar('me_gusta');
  assert.equal(puesta.body.reacciones.me_gusta, 1);

  const cambiada = await reaccionar('apoyo');
  assert.equal(cambiada.body.reacciones.me_gusta ?? 0, 0);
  assert.equal(cambiada.body.reacciones.apoyo, 1);

  const quitada = await reaccionar('apoyo');
  assert.equal(quitada.body.reacciones.apoyo ?? 0, 0);
});
