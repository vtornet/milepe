import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, CONTRASEÑA } from './ayuda.js';
import { usarClienteGoogle } from '../src/utils/googleAuth.js';

// Los tests no llaman a Google de verdad: se inyecta un cliente que devuelve
// el payload que se le pida, y la verificacion de firma/caducidad/audience
// queda fuera de alcance aqui (eso lo hace googleAuth.js contra la API de
// Google; no hay red en los tests).
process.env.GOOGLE_CLIENT_ID = '123456789000-prueba.apps.googleusercontent.com';

const credencialGoogle = () => ({ credential: 'credencial-de-prueba' });

// Recibe los datos como los usa la app y los devuelve con la forma del
// payload de Google (sub, name, picture, email_verified), que es lo que lee
// googleAuth.js. Sin email_verified explícito, Google lo da por verificado.
const conGoogle = ({ google_id, email, nombre, avatar_url, email_verified = true }) => {
  const payload = { sub: google_id, email, email_verified, name: nombre, picture: avatar_url ?? undefined };
  const clienteFalso = {
    verifyIdToken: async () => ({
      getPayload: () => payload,
    }),
  };
  usarClienteGoogle(clienteFalso);
};

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

test('la foto de perfil se puede subir antes de tener el perfil completo (pero no sin verificar el correo)', async () => {
  // Sin archivo: si pasa la puerta, el controlador contesta 400 "No se ha
  // enviado ninguna imagen" sin llegar a Cloudinary.
  const incompleto = await t.crearUsuario({ perfil_completo: false });
  const r = await t.api.post('/subidas/avatar', {}, { token: incompleto.token });
  assert.equal(r.status, 400, 'pasa la puerta: era el bloqueo circular');
  assert.match(r.body.mensaje, /ninguna imagen/);

  const sinVerificar = await t.crearUsuario({ email_verificado: false, perfil_completo: false });
  const r2 = await t.api.post('/subidas/avatar', {}, { token: sinVerificar.token });
  assert.equal(r2.status, 403);
  assert.equal(r2.body.razon, 'email_sin_verificar');

  // Las imágenes de publicaciones siguen exigiendo el perfil completo.
  assert.equal((await t.api.post('/subidas/imagenes', {}, { token: incompleto.token })).status, 403);
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


// --- Entrar con Google ---

// Caso 1: ya existe una cuenta con ese google_id -> entra.
test('entrar con Google con una cuenta ya vinculada devuelve sesion', async () => {
  await t.crearUsuario({ google_id: 'google-123', email: 'juan@ejemplo.com', nombre: 'Juan' });
  conGoogle({ google_id: 'google-123', email: 'juan@ejemplo.com', nombre: 'Juan', avatar_url: null });

  const r = await t.api.post('/auth/google', credencialGoogle());
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
  // google_id no sale en la respuesta (ni el nombre real): se mira en la base.
  const { default: Usuario } = await import('../src/models/Usuario.js');
  assert.equal((await Usuario.findById(r.body.usuario._id).select('+google_id')).google_id, 'google-123');
});

// Caso 2: no hay cuenta con ese google_id ni con ese email -> se crea una nueva.
test('entrar con Google crea la cuenta si no existe', async () => {
  conGoogle({
    google_id: 'google-nuevo',
    email: 'nueva@ejemplo.com',
    nombre: 'Ana Gomez',
    avatar_url: 'https://ejemplo.com/foto.jpg',
  });

  const r = await t.api.post('/auth/google', credencialGoogle());
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
  assert.equal(r.body.usuario.email_verificado, true);
  assert.equal(r.body.usuario.avatar_url, 'https://ejemplo.com/foto.jpg');
  assert.equal(r.body.usuario.google_id, undefined);
  assert.equal(r.body.usuario.nombre, undefined);
  const { default: Usuario } = await import('../src/models/Usuario.js');
  const guardado = await Usuario.findById(r.body.usuario._id).select('+nombre +google_id');
  assert.equal(guardado.email, 'nueva@ejemplo.com');
  assert.equal(guardado.google_id, 'google-nuevo');
  assert.equal(guardado.nombre, 'Ana Gomez');
  assert.equal(r.body.usuario.contraseña, undefined);
  // Genera un nombre de usuario a partir del correo porque Google no da ninguno.
  assert.match(r.body.usuario.nombre_usuario, /^nueva/);
});

// Caso 3: existe una cuenta con ese email (registrada con contraseña) -> se
// vincula, no se duplica.
test('entrar con Google vincula la cuenta existente por email sin duplicar', async () => {
  await t.crearUsuario({ email: 'existente@ejemplo.com', nombre_usuario: 'existente_vecino', contraseña: CONTRASEÑA });
  conGoogle({ google_id: 'google-vinculo', email: 'existente@ejemplo.com', nombre: 'Existente', avatar_url: null });

  const r = await t.api.post('/auth/google', credencialGoogle());
  assert.equal(r.status, 200);
  assert.equal(r.body.usuario.nombre_usuario, 'existente_vecino');
  assert.equal(r.body.usuario.email_verificado, true);

  const { default: Usuario } = await import('../src/models/Usuario.js');
  assert.equal(await Usuario.countDocuments({ email: 'existente@ejemplo.com' }), 1);
  assert.equal((await Usuario.findOne({ email: 'existente@ejemplo.com' }).select('+google_id')).google_id, 'google-vinculo');
});

// El correo de Google debe estar verificado: si no, no se entra ni se crea.
test('entrar con Google rechaza el correo no verificado', async () => {
  conGoogle({ google_id: 'google-nv', email: 'noverificado@ejemplo.com', email_verified: false });

  const r = await t.api.post('/auth/google', credencialGoogle());
  assert.equal(r.status, 401);
});

// Una cuenta desactivada no entra por ninguna puerta.
test('entrar con Google con cuenta desactivada responde 401', async () => {
  await t.crearUsuario({ google_id: 'google-des', email: 'desactivada@ejemplo.com', activo: false });
  conGoogle({ google_id: 'google-des', email: 'desactivada@ejemplo.com', nombre: 'Des' });

  const r = await t.api.post('/auth/google', credencialGoogle());
  assert.equal(r.status, 401);
});

// Una cuenta suspendida responde 403 con la razon de la suspension.
test('entrar con Google con cuenta suspendida responde 403 con razon', async () => {
  const { usuario } = await t.crearUsuario({ google_id: 'google-susp', email: 'suspensa@ejemplo.com' });
  usuario.suspension = { hasta: new Date(Date.now() + 86400000), motivo: 'prueba', desde: new Date() };
  await usuario.save();
  conGoogle({ google_id: 'google-susp', email: 'suspensa@ejemplo.com', nombre: 'Susp' });

  const r = await t.api.post('/auth/google', credencialGoogle());
  assert.equal(r.status, 403);
  assert.equal(r.body.razon, 'cuenta_suspendida');
});
