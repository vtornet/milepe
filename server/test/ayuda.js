// Ayudante comun de los tests: levanta la API de verdad (app.js, sin
// server.js, asi que sin crons ni puerto fijo) contra una MongoDB en
// memoria, y da una forma corta de hacer peticiones y crear vecinos.
//
// Cada archivo *.test.js corre en su propio proceso (node --test), asi que
// cada uno arranca su propia base y no hay estado compartido entre ellos.
//
// El entorno se fija al importar este modulo, ANTES de cargar app.js:
// helmet y morgan leen NODE_ENV al montarse.
import { randomBytes } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
// Aleatorio en cada ejecucion en vez de una cadena escrita en el codigo: no
// hay nada que se parezca a un secreto en el repositorio (los escaneres de
// secretos lo marcan aunque sea de pruebas) y ningun test depende de su valor.
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.CLIENT_URL = 'http://localhost:5173';
// Sin esto, cada registro intentaria mandar un correo de verdad.
delete process.env.SMTP_HOST;

export const CONTRASEÑA = 'contraseña-de-prueba-1';

let contador = 0;

export async function arrancar({ limites = false } = {}) {
  process.env.LIMITES_DESACTIVADOS = limites ? '0' : '1';

  const mongo = await MongoMemoryServer.create();
  const { default: mongoose } = await import('mongoose');
  await mongoose.connect(mongo.getUri('milepe_test'));

  const { default: app } = await import('../src/app.js');
  const { default: Usuario } = await import('../src/models/Usuario.js');
  const { firmarToken } = await import('../src/utils/jwt.js');

  const servidor = app.listen(0);
  const base = `http://127.0.0.1:${servidor.address().port}/api`;

  // El manejador de errores de app.js hace console.error de CADA error,
  // incluidos los 4xx que los tests provocan a proposito.
  const consolaError = console.error;
  const consolaLog = console.log;
  console.error = () => {};
  console.log = () => {};

  const pedir = async (metodo, ruta, { token, cuerpo, ip } = {}) => {
    const respuesta = await fetch(base + ruta, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(ip ? { 'X-Forwarded-For': ip } : {}),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const texto = await respuesta.text();
    let json = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      json = texto;
    }
    return { status: respuesta.status, body: json, cabeceras: respuesta.headers };
  };

  const api = {
    get: (ruta, opciones) => pedir('GET', ruta, opciones),
    post: (ruta, cuerpo, opciones) => pedir('POST', ruta, { ...opciones, cuerpo }),
    patch: (ruta, cuerpo, opciones) => pedir('PATCH', ruta, { ...opciones, cuerpo }),
    put: (ruta, cuerpo, opciones) => pedir('PUT', ruta, { ...opciones, cuerpo }),
    delete: (ruta, opciones) => pedir('DELETE', ruta, opciones),
  };

  // Un vecino ya con el correo verificado y el perfil completo (lo que hace
  // falta para escribir), o con lo que se pida en `extra`.
  const crearUsuario = async ({ rol = 'usuario', ...extra } = {}) => {
    contador += 1;
    const usuario = await Usuario.create({
      nombre_usuario: `vecino${contador}`,
      nombre: 'Nombre',
      apellidos: 'Apellido',
      email: `vecino${contador}@ejemplo.com`,
      contraseña: CONTRASEÑA,
    });
    usuario.rol = rol;
    usuario.email_verificado = true;
    usuario.perfil_completo = true;
    Object.assign(usuario, extra);
    await usuario.save();

    return { usuario, id: String(usuario._id), token: firmarToken(usuario._id) };
  };

  const detener = async () => {
    console.error = consolaError;
    console.log = consolaLog;
    await new Promise((resolver) => servidor.close(resolver));
    await mongoose.disconnect();
    await mongo.stop();
  };

  return { api, base, crearUsuario, detener, mongoose };
}

export const quejaValida = (extra = {}) => ({
  titulo: 'Bache en la calle Real',
  contenido: 'Lleva meses sin arreglar',
  categoria: 'obras',
  ubicacion: { lat: 37.25, lng: -7.2 },
  ...extra,
});
