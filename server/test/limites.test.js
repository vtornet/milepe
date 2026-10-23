import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, CONTRASEÑA } from './ayuda.js';

let t;
before(async () => {
  // Único archivo con los límites encendidos.
  t = await arrancar({ limites: true });
});
after(() => t.detener());

// Sin trust proxy (solo se activa en producción) Express ignora
// X-Forwarded-For y todas las peticiones del test salen de 127.0.0.1, que es
// una sola "persona" para el limitador. Por eso los tests comparten el cupo
// y su orden importa: el de los accesos fallidos va después del de los
// correctos, y los dos gastan el mismo contador (/login, /google,
// /restablecer y /verificar comparten limitador).
const loginMalo = () => t.api.post('/auth/login', { email: 'nadie@ejemplo.com', contraseña: 'mala-contraseña-1' });

test('los accesos correctos no gastan cupo: solo cuentan los fallidos', async () => {
  const { usuario } = await t.crearUsuario();

  // Bastantes más que el límite de fallos: si contaran, ya habría 429.
  for (let i = 0; i < 15; i++) {
    const r = await t.api.post('/auth/login', { email: usuario.email, contraseña: CONTRASEÑA });
    assert.equal(r.status, 200, `acceso correcto nº ${i + 1}`);
  }
});

test('tras 10 intentos de acceso fallidos, el 11º recibe 429 en el formato de siempre', async () => {
  const estados = [];
  for (let i = 0; i < 10; i++) estados.push((await loginMalo()).status);
  assert.deepEqual(estados, Array(10).fill(401));

  const bloqueado = await loginMalo();
  assert.equal(bloqueado.status, 429);
  assert.equal(bloqueado.body.ok, false);
  assert.equal(bloqueado.body.razon, 'demasiadas_peticiones');
  assert.ok(bloqueado.body.mensaje);
  assert.ok(bloqueado.cabeceras.get('retry-after'), 'dice cuánto esperar');
});

test('con el cupo de acceso agotado, el resto de la API sigue funcionando', async () => {
  assert.equal((await t.api.get('/posts')).status, 200);
  assert.equal((await t.api.get('/health')).status, 200);
});

test('registrarse tiene su propio cupo por hora, aunque salga bien', async () => {
  const registrar = (i) =>
    t.api.post('/auth/registro', {
      nombre_usuario: `masivo${i}`,
      nombre: 'Masivo',
      email: `masivo${i}@ejemplo.com`,
      contraseña: CONTRASEÑA,
    });

  for (let i = 0; i < 10; i++) assert.equal((await registrar(i)).status, 201);
  assert.equal((await registrar(11)).status, 429);
});

test('las cabeceras de seguridad de helmet salen en las respuestas', async () => {
  const r = await t.api.get('/posts');
  assert.equal(r.cabeceras.get('x-content-type-options'), 'nosniff');
  assert.equal(r.cabeceras.get('x-powered-by'), null);
});
