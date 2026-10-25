import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar } from './ayuda.js';

let t;
let vecino;
let moderador;
let admin;

before(async () => {
  t = await arrancar();
  vecino = await t.crearUsuario();
  moderador = await t.crearUsuario({ rol: 'moderador' });
  admin = await t.crearUsuario({ rol: 'admin' });
});
after(() => t.detener());

const contacto = (extra = {}) => ({
  nombre: 'Farmacia Central',
  categoria: 'centro_salud',
  telefono: '959000000',
  ...extra,
});

test('las rutas de administrador rechazan sin sesión, a un vecino y a un moderador', async () => {
  const rutas = [
    ['get', '/estadisticas'],
    ['get', '/contactos-interes/todos'],
    ['post', '/contactos-interes', contacto()],
    ['get', '/turismo/todos'],
    ['post', '/turismo', {}],
  ];

  for (const [metodo, ruta, cuerpo] of rutas) {
    const llamar = (opciones) => (cuerpo === undefined ? t.api[metodo](ruta, opciones) : t.api[metodo](ruta, cuerpo, opciones));

    assert.equal((await llamar()).status, 401, `${metodo} ${ruta} sin sesión`);
    assert.equal((await llamar({ token: vecino.token })).status, 403, `${metodo} ${ruta} vecino`);
    assert.equal((await llamar({ token: moderador.token })).status, 403, `${metodo} ${ruta} moderador`);
  }
});

test('un admin ve las estadísticas', async () => {
  const r = await t.api.get('/estadisticas', { token: admin.token });
  assert.equal(r.status, 200);
});

test('contactos: crear, ocultar y reactivar; el público solo ve los activos', async () => {
  const creado = await t.api.post('/contactos-interes', contacto(), { token: admin.token });
  assert.equal(creado.status, 201);
  const id = creado.body.contacto._id;

  const nombres = async () => (await t.api.get('/contactos-interes')).body.contactos.map((c) => c.nombre);
  assert.ok((await nombres()).includes('Farmacia Central'));

  await t.api.patch(`/contactos-interes/${id}`, { activo: false }, { token: admin.token });
  assert.equal((await nombres()).includes('Farmacia Central'), false);

  const todos = await t.api.get('/contactos-interes/todos', { token: admin.token });
  assert.ok(todos.body.contactos.some((c) => c._id === id), 'el admin sí lo ve, para poder reactivarlo');

  await t.api.patch(`/contactos-interes/${id}`, { activo: true }, { token: admin.token });
  assert.ok((await nombres()).includes('Farmacia Central'));
});

test('contactos: no se puede colar un campo que no esté en la lista', async () => {
  const r = await t.api.post(
    '/contactos-interes',
    contacto({ nombre: 'Con extras', _id: '000000000000000000000001', fecha_creacion: '2001-01-01' }),
    { token: admin.token },
  );
  assert.equal(r.status, 201);
  assert.notEqual(r.body.contacto._id, '000000000000000000000001');
  assert.notEqual(new Date(r.body.contacto.fecha_creacion).getFullYear(), 2001);
});

test('contactos: un correo mal formado o un teléfono ausente se rechaza', async () => {
  assert.equal((await t.api.post('/contactos-interes', contacto({ email: 'no-es-un-correo' }), { token: admin.token })).status, 400);
  assert.equal((await t.api.post('/contactos-interes', contacto({ telefono: undefined }), { token: admin.token })).status, 400);
});

test('contactos: eliminar de verdad lo quita y repetirlo da 404', async () => {
  const creado = await t.api.post('/contactos-interes', contacto({ nombre: 'Para borrar' }), { token: admin.token });
  const id = creado.body.contacto._id;
  assert.equal((await t.api.delete(`/contactos-interes/${id}`, { token: admin.token })).status, 200);
  assert.equal((await t.api.delete(`/contactos-interes/${id}`, { token: admin.token })).status, 404);
});

test('el perfil público no revela el nombre real, los apellidos ni el correo', async () => {
  const r = await t.api.get(`/usuarios/${vecino.id}`);
  assert.equal(r.status, 200);
  const texto = JSON.stringify(r.body);
  assert.equal(texto.includes('Apellido'), false);
  assert.equal(texto.includes(vecino.usuario.email), false);
});

test('un id mal formado en la URL es un 400, no un 500', async () => {
  assert.equal((await t.api.get('/posts/esto-no-es-un-id')).status, 400);
});

test('el Muro es público: se lee sin cuenta', async () => {
  assert.equal((await t.api.get('/posts')).status, 200);
});

test('nombrar y quitar moderadores y admins: solo un admin, nunca a sí mismo', async () => {
  const candidato = await t.crearUsuario();
  const cambiar = (quien, id, rol) => t.api.patch(`/usuarios/${id}/rol`, { rol }, { token: quien.token });

  assert.equal((await cambiar(vecino, candidato.id, 'moderador')).status, 403);
  assert.equal((await cambiar(moderador, candidato.id, 'moderador')).status, 403);
  assert.equal((await cambiar(admin, candidato.id, 'jefe')).status, 400, 'rol desconocido');
  assert.equal((await cambiar(admin, admin.id, 'usuario')).status, 400, 'ni a uno mismo');

  assert.equal((await cambiar(admin, candidato.id, 'moderador')).body.usuario.rol, 'moderador');
  assert.equal((await t.api.get('/moderacion/reportes', { token: candidato.token })).status, 200, 'ya ve la cola');
  const avisos = (await t.api.get('/notificaciones', { token: candidato.token })).body.notificaciones;
  assert.ok(avisos.some((n) => /equipo de moderación/.test(n.mensaje)));

  assert.equal((await cambiar(admin, candidato.id, 'usuario')).body.usuario.rol, 'usuario');
  assert.equal((await t.api.get('/moderacion/reportes', { token: candidato.token })).status, 403, 'y deja de verla al momento');
});

test('panel de usuarios: solo admin, con datos privados, filtros y rol de admin', async () => {
  assert.equal((await t.api.get('/usuarios/admin', { token: vecino.token })).status, 403);
  assert.equal((await t.api.get('/usuarios/admin', { token: moderador.token })).status, 403);
  assert.equal((await t.api.get('/usuarios/admin')).status, 401);

  const nuevo = await t.crearUsuario();
  const lista = await t.api.get(`/usuarios/admin?q=${encodeURIComponent(nuevo.usuario.email)}`, { token: admin.token });
  assert.equal(lista.status, 200);
  const fila = lista.body.usuarios.find((u) => String(u._id) === String(nuevo.id));
  assert.ok(fila, 'sale por correo');
  assert.ok(fila.email && fila.nombre, 'lleva correo y nombre real');
  assert.equal(fila.contraseña, undefined);
  assert.equal(fila.google_id, undefined);

  assert.equal((await t.api.get('/usuarios/admin?rol=jefe', { token: admin.token })).status, 400);
  assert.equal((await t.api.get('/usuarios/admin?estado=raro', { token: admin.token })).status, 400);

  // Nombrar admin deja rastro en el registro y le da la insignia.
  const r = await t.api.patch(`/usuarios/${nuevo.id}/rol`, { rol: 'admin' }, { token: admin.token });
  assert.equal(r.body.usuario.rol, 'admin');
  const admins = await t.api.get('/usuarios/admin?rol=admin', { token: admin.token });
  assert.ok(admins.body.usuarios.some((u) => String(u._id) === String(nuevo.id) && u.verificado_manual));
  const registro = await t.api.get('/moderacion/registro', { token: admin.token });
  assert.ok(JSON.stringify(registro.body).includes('rol_cambiado'));
  assert.equal((await t.api.patch(`/usuarios/${nuevo.id}/rol`, { rol: 'usuario' }, { token: admin.token })).body.usuario.rol, 'usuario');
});
