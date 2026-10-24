import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, CONTRASEÑA } from './ayuda.js';

let t;
before(async () => {
  t = await arrancar();
});
after(() => t.detener());

const registro = (extra = {}) => ({
  nombre_usuario: 'nuevo_vecino',
  nombre: 'Pepe',
  apellidos: 'Pérez',
  email: 'nuevo@ejemplo.com',
  contraseña: CONTRASEÑA,
  ...extra,
});

test('registrarse no deja colar un rol de admin', async () => {
  const { status, body } = await t.api.post('/auth/registro', registro({ rol: 'admin', email_verificado: true }));
  assert.equal(status, 201);
  assert.equal(body.usuario.rol, 'usuario');
  assert.equal(body.usuario.email_verificado, false);
});

test('la respuesta del registro no filtra el nombre real, los apellidos ni el hash', async () => {
  const { body } = await t.api.post(
    '/auth/registro',
    registro({ nombre_usuario: 'otro_vecino', email: 'otro@ejemplo.com' }),
  );
  for (const campo of ['nombre', 'apellidos', 'contraseña']) {
    assert.equal(campo in body.usuario, false, `${campo} no debe salir`);
  }
});

test('login: mismo error para email desconocido, contraseña mala y cuenta desactivada', async () => {
  const { usuario } = await t.crearUsuario({ activo: false });

  const desconocido = await t.api.post('/auth/login', { email: 'nadie@ejemplo.com', contraseña: CONTRASEÑA });
  const mala = await t.api.post('/auth/login', { email: 'nuevo@ejemplo.com', contraseña: 'incorrecta-1234' });
  const desactivada = await t.api.post('/auth/login', { email: usuario.email, contraseña: CONTRASEÑA });

  for (const r of [desconocido, mala, desactivada]) assert.equal(r.status, 401);
  assert.equal(desconocido.body.mensaje, mala.body.mensaje);
  assert.equal(mala.body.mensaje, desactivada.body.mensaje);
});

test('login correcto devuelve token y un token válido da acceso al perfil', async () => {
  const entrada = await t.api.post('/auth/login', { email: 'nuevo@ejemplo.com', contraseña: CONTRASEÑA });
  assert.equal(entrada.status, 200);
  assert.ok(entrada.body.token);

  const perfil = await t.api.get('/auth/perfil', { token: entrada.body.token });
  assert.equal(perfil.status, 200);
});

test('sin token o con un token falso no se entra a una ruta protegida', async () => {
  assert.equal((await t.api.get('/auth/perfil')).status, 401);
  assert.equal((await t.api.get('/auth/perfil', { token: 'esto.no.vale' })).status, 401);
});

test('desactivar una cuenta invalida al instante los tokens ya emitidos', async () => {
  const { usuario, token } = await t.crearUsuario();
  assert.equal((await t.api.get('/auth/perfil', { token })).status, 200);

  usuario.activo = false;
  await usuario.save();
  assert.equal((await t.api.get('/auth/perfil', { token })).status, 401);
});

test('escribir exige correo verificado y perfil completo, con su razón', async () => {
  const sinVerificar = await t.crearUsuario({ email_verificado: false });
  const r1 = await t.api.post('/quejas', {}, { token: sinVerificar.token });
  assert.equal(r1.status, 403);
  assert.equal(r1.body.razon, 'email_sin_verificar');

  const incompleto = await t.crearUsuario({ perfil_completo: false });
  const r2 = await t.api.post('/quejas', {}, { token: incompleto.token });
  assert.equal(r2.status, 403);
  assert.equal(r2.body.razon, 'perfil_incompleto');
});

test('una cuenta sin verificar tampoco puede reportar por la ruta genérica', async () => {
  const autor = await t.crearUsuario();
  const queja = await t.api.post('/quejas', { titulo: 'Q', contenido: 'x', categoria: 'obras', ubicacion: { lat: 37.25, lng: -7.2 } }, { token: autor.token });
  const sinVerificar = await t.crearUsuario({ email_verificado: false });
  const r = await t.api.post(
    '/moderacion/reportes',
    { contenido_tipo: 'post', contenido_id: queja.body.queja._id, motivo: 'spam' },
    { token: sinVerificar.token },
  );
  assert.equal(r.status, 403);
  assert.equal(r.body.razon, 'email_sin_verificar');
});

test('recuperar contraseña contesta lo mismo exista o no la cuenta', async () => {
  const existe = await t.api.post('/auth/recuperar', { email: 'nuevo@ejemplo.com' });
  const noExiste = await t.api.post('/auth/recuperar', { email: 'fantasma@ejemplo.com' });
  assert.equal(existe.status, noExiste.status);
  assert.deepEqual(existe.body, noExiste.body);
});

test('restablecer con un token inventado falla', async () => {
  const r = await t.api.post('/auth/restablecer', { token: 'inventado', contraseña: 'otra-contraseña-123' });
  assert.ok(r.status >= 400 && r.status < 500);
});
