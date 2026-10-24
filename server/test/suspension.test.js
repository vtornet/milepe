import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, quejaValida, CONTRASEÑA } from './ayuda.js';
import { normalizarCorreo } from '../src/models/CorreoBloqueado.js';

let t;
let admin;
let moderador;
let vecino;
let Usuario;

before(async () => {
  t = await arrancar();
  admin = await t.crearUsuario({ rol: 'admin' });
  moderador = await t.crearUsuario({ rol: 'moderador' });
  vecino = await t.crearUsuario();
  Usuario = (await import('../src/models/Usuario.js')).default;
});
after(() => t.detener());

const suspender = (quien, a, cuerpo) => t.api.put(`/usuarios/${a.id}/suspension`, cuerpo, { token: quien.token });
const entrar = async (u) => {
  const { email } = await Usuario.findById(u.id);
  return t.api.post('/auth/login', { email, contraseña: CONTRASEÑA });
};

test('solo un admin suspende, con motivo y duración válida; nunca a un admin ni a sí mismo', async () => {
  assert.equal((await suspender(moderador, vecino, { motivo: 'x', dias: 7 })).status, 403);
  assert.equal((await suspender(admin, vecino, { dias: 7 })).status, 400, 'sin motivo');
  assert.equal((await suspender(admin, vecino, { motivo: 'x', dias: 0 })).status, 400);
  assert.equal((await suspender(admin, vecino, { motivo: 'x', dias: 999 })).status, 400);
  assert.equal((await suspender(admin, vecino, { motivo: 'x' })).status, 400, 'ni días ni permanente');
  assert.equal((await suspender(admin, admin, { motivo: 'x', dias: 1 })).status, 400);
  const otroAdmin = await t.crearUsuario({ rol: 'admin' });
  assert.equal((await suspender(admin, otroAdmin, { motivo: 'x', dias: 1 })).status, 409);
});

test('suspendido: no entra, su sesión deja de valer salvo para sus datos, y lee como anónimo', async () => {
  const r = await suspender(admin, vecino, { motivo: 'Insultos reiterados', dias: 7 });
  assert.equal(r.status, 200);
  assert.ok(new Date(r.body.suspension.hasta) > new Date(Date.now() + 6 * 86400000));

  const login = await entrar(vecino);
  assert.equal(login.status, 403);
  assert.equal(login.body.razon, 'cuenta_suspendida');
  assert.match(login.body.mensaje, /suspendida hasta el .*Motivo: Insultos reiterados/);

  // El token que ya tenía:
  const publicar = await t.api.post('/quejas', quejaValida(), { token: vecino.token });
  assert.equal(publicar.status, 403);
  assert.equal(publicar.body.razon, 'cuenta_suspendida');
  assert.equal((await t.api.get('/usuarios/perfil', { token: vecino.token })).status, 200);
  assert.equal((await t.api.get('/usuarios/perfil/exportar', { token: vecino.token })).status, 200);
  // Una página pública con su token se ve, como anónimo.
  const ficha = await t.api.get(`/usuarios/${admin.id}`, { token: vecino.token });
  assert.equal(ficha.status, 200);
  assert.equal(ficha.body.relacion, null);
});

test('la contraseña mal sigue dando el mensaje genérico (no revela la suspensión)', async () => {
  const { email } = await Usuario.findById(vecino.id);
  const r = await t.api.post('/auth/login', { email, contraseña: 'otra-cosa-123' });
  assert.equal(r.status, 401);
  assert.equal(r.body.razon, undefined);
});

test('la ficha enseña la suspensión solo al admin, y queda en el registro', async () => {
  assert.equal((await t.api.get(`/usuarios/${vecino.id}`, { token: admin.token })).body.usuario.suspension.motivo, 'Insultos reiterados');
  assert.equal((await t.api.get(`/usuarios/${vecino.id}`, { token: moderador.token })).body.usuario.suspension, undefined);
  assert.equal((await t.api.get(`/usuarios/${vecino.id}`)).body.usuario.suspension, undefined);

  const registro = await t.api.get(`/moderacion/registro?contenido_id=${vecino.id}`, { token: moderador.token });
  assert.equal(registro.status, 200);
  assert.equal(registro.body.registro[0].accion, 'cuenta_suspendida');
});

test('una temporal se acaba sola; levantarla a mano devuelve el acceso', async () => {
  await Usuario.updateOne({ _id: vecino.id }, { 'suspension.hasta': new Date(Date.now() - 1000) });
  assert.equal((await entrar(vecino)).status, 200, 'caducada: entra');

  await suspender(admin, vecino, { motivo: 'Spam', permanente: true });
  assert.match((await entrar(vecino)).body.mensaje, /de forma indefinida/);
  assert.equal((await t.api.delete(`/usuarios/${vecino.id}/suspension`, { token: moderador.token })).status, 403);
  assert.equal((await t.api.delete(`/usuarios/${vecino.id}/suspension`, { token: admin.token })).status, 200);
  assert.equal((await entrar(vecino)).status, 200);
  assert.equal((await t.api.delete(`/usuarios/${vecino.id}/suspension`, { token: admin.token })).status, 409, 'ya no lo está');
});

test('borrar la cuenta estando suspendido veta el correo (también con trucos) mientras dure', async () => {
  const pepe = await t.crearUsuario();
  const { email } = await Usuario.findById(pepe.id);
  await suspender(admin, pepe, { motivo: 'Acoso', permanente: true });
  const borrar = await t.api.delete('/usuarios/perfil', { token: pepe.token, cuerpo: { contraseña: CONTRASEÑA } });
  assert.equal(borrar.status, 200, JSON.stringify(borrar.body));

  const [local, dominio] = email.split('@');
  const registro = (correo) =>
    t.api.post('/auth/registro', { nombre_usuario: `nuevo${Date.now()}`, nombre: 'Pepe', apellidos: 'P', email: correo, contraseña: CONTRASEÑA });
  assert.equal((await registro(email)).status, 403);
  assert.equal((await registro(`${local.toUpperCase()}+otra@${dominio}`)).status, 403);
  assert.equal((await registro(`libre${Date.now()}@${dominio}`)).status, 201, 'otro correo sí');
});

test('normalizar correos: mayúsculas, +sufijo y puntos de Gmail', () => {
  assert.equal(normalizarCorreo(' Pepe.Lopez+milepe@GoogleMail.com '), 'pepelopez@gmail.com');
  assert.equal(normalizarCorreo('pe.pe+x@ejemplo.es'), 'pe.pe@ejemplo.es');
});
