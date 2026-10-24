import zlib from 'node:zlib';
import mongoose from 'mongoose';
import streamifier from 'streamifier';
import cloudinary from '../config/cloudinary.js';

// Copias de seguridad de MongoDB sin mongodump: Railway no deja un binario
// a mano y la base es pequena, asi que se vuelca con el propio driver.
//
// Formato: un fichero gzip de lineas JSON (EJSON canonico, que conserva
// ObjectId, fechas y Decimal sin convertirlos a texto):
//   {"copia":{"version":1,"fecha":"...","base":"milepe"}}
//   {"indices":"posts","lista":[{...}]}
//   {"c":"posts","d":{...documento...}}
// Una linea por documento, para poder leerlo de uno en uno al restaurar.

const { EJSON } = mongoose.mongo.BSON;

export const VERSION_FORMATO = 1;
export const CARPETA_COPIAS = 'milepe-copias';
// Cuantas copias se conservan. A diario son dos semanas de margen para
// notar que algo se rompio, sin acumular para siempre.
export const COPIAS_A_GUARDAR = 14;

const OPCIONES_CLOUDINARY = { resource_type: 'raw', type: 'authenticated' };

// La copia lleva hashes de contrasena, correos y mensajes privados:
// 'authenticated' hace que Cloudinary solo sirva el fichero con una URL
// firmada, nunca por una direccion publica.

const serializar = (documento) => EJSON.serialize(documento, { relaxed: false });

export const volcarBase = async (db = mongoose.connection.db) => {
  const gzip = zlib.createGzip({ level: 9 });
  const trozos = [];
  gzip.on('data', (trozo) => trozos.push(trozo));
  const terminado = new Promise((resolver, rechazar) => {
    gzip.on('end', resolver);
    gzip.on('error', rechazar);
  });

  const escribir = (objeto) => gzip.write(`${JSON.stringify(objeto)}\n`);

  const fecha = new Date();
  escribir({ copia: { version: VERSION_FORMATO, fecha: fecha.toISOString(), base: db.databaseName } });

  const colecciones = {};
  const infos = await db.listCollections({}, { nameOnly: true }).toArray();

  for (const { name } of infos.sort((a, b) => a.name.localeCompare(b.name))) {
    if (name.startsWith('system.')) continue;

    const coleccion = db.collection(name);
    escribir({ indices: name, lista: await coleccion.indexes() });

    let total = 0;
    for await (const documento of coleccion.find({})) {
      escribir({ c: name, d: serializar(documento) });
      total += 1;
    }
    colecciones[name] = total;
  }

  gzip.end();
  await terminado;

  return { buffer: Buffer.concat(trozos), colecciones, fecha, base: db.databaseName };
};

// "milepe-2026-10-23T04-00-00Z.ejsonl.gz": ordenable por nombre y sin
// caracteres que molesten en una URL.
export const nombreDeCopia = (fecha = new Date()) =>
  `milepe-${fecha.toISOString().replace(/\.\d+Z$/, 'Z').replace(/:/g, '-')}.ejsonl.gz`;

export const subirCopia = (buffer, nombre) =>
  new Promise((resolver, rechazar) => {
    const subida = cloudinary.uploader.upload_stream(
      { ...OPCIONES_CLOUDINARY, folder: CARPETA_COPIAS, public_id: nombre, overwrite: false },
      (error, resultado) => (error ? rechazar(error) : resolver(resultado)),
    );
    streamifier.createReadStream(buffer).pipe(subida);
  });

// De la mas reciente a la mas antigua.
export const listarCopias = async () => {
  const copias = [];
  let siguiente;

  do {
    const respuesta = await cloudinary.api.resources({
      ...OPCIONES_CLOUDINARY,
      prefix: `${CARPETA_COPIAS}/`,
      max_results: 500,
      next_cursor: siguiente,
    });
    copias.push(...respuesta.resources);
    siguiente = respuesta.next_cursor;
  } while (siguiente);

  return copias
    .map((r) => ({ id: r.public_id, bytes: r.bytes, fecha: new Date(r.created_at) }))
    .sort((a, b) => b.fecha - a.fecha);
};

// Borra las que sobran por encima de COPIAS_A_GUARDAR. Se llama DESPUES de
// subir la nueva: si la subida falla, no se ha tirado ninguna copia buena.
export const rotarCopias = async (guardar = COPIAS_A_GUARDAR) => {
  const sobran = (await listarCopias()).slice(guardar);
  if (sobran.length > 0) {
    await cloudinary.api.delete_resources(
      sobran.map((c) => c.id),
      OPCIONES_CLOUDINARY,
    );
  }
  return sobran.length;
};

export const descargarCopia = async (id) => {
  // URL firmada de la API de administracion, caduca en una hora. La URL de
  // entrega firmada (cloudinary.url con sign_url) respondia 401 para un
  // fichero raw autenticado.
  const url = cloudinary.utils.private_download_url(id, '', OPCIONES_CLOUDINARY);
  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(`Cloudinary respondio ${respuesta.status} al descargar ${id}`);
  }
  return Buffer.from(await respuesta.arrayBuffer());
};

export const hayCredencialesCloudinary = () =>
  Boolean(
    (process.env.CLOUDINARY_CLOUD_NAME || '').trim() &&
      (process.env.CLOUDINARY_API_KEY || '').trim() &&
      (process.env.CLOUDINARY_API_SECRET || '').trim(),
  );

// Volcar + subir + rotar. Lo comparten el cron y el script manual.
export const hacerCopia = async () => {
  const { buffer, colecciones, fecha, base } = await volcarBase();
  const nombre = nombreDeCopia(fecha);
  const subida = await subirCopia(buffer, nombre);
  const borradas = await rotarCopias();

  return { id: subida.public_id, bytes: buffer.length, colecciones, base, borradas };
};

// --- Restaurar ---

// Lee el buffer de una copia y devuelve sus partes ya deserializadas.
export const leerCopia = (buffer) => {
  const lineas = zlib
    .gunzipSync(buffer)
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const cabecera = lineas[0]?.copia;
  if (!cabecera) throw new Error('El fichero no parece una copia de MiLepe (falta la cabecera)');
  if (cabecera.version !== VERSION_FORMATO) {
    throw new Error(`Version de copia ${cabecera.version} no soportada (esta es la ${VERSION_FORMATO})`);
  }

  const indices = new Map();
  const documentos = new Map();
  for (const linea of lineas.slice(1)) {
    if (linea.indices) indices.set(linea.indices, linea.lista);
    else if (linea.c) {
      if (!documentos.has(linea.c)) documentos.set(linea.c, []);
      documentos.get(linea.c).push(EJSON.deserialize(linea.d, { relaxed: false }));
    }
  }

  return { cabecera, indices, documentos };
};

// Vuelca una copia leida en `db`. Por seguridad se niega a tocar una
// coleccion que ya tenga datos salvo que se pida `vaciar`.
export const restaurarCopia = async (db, copia, { vaciar = false } = {}) => {
  const nombres = new Set([...copia.indices.keys(), ...copia.documentos.keys()]);
  const existentes = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  if (!vaciar) {
    for (const nombre of nombres) {
      if (existentes.has(nombre) && (await db.collection(nombre).countDocuments({}, { limit: 1 })) > 0) {
        throw new Error(`La coleccion "${nombre}" ya tiene datos. Usa --vaciar si quieres sustituirla.`);
      }
    }
  }

  const resumen = {};
  for (const nombre of nombres) {
    const coleccion = db.collection(nombre);
    if (existentes.has(nombre)) await coleccion.drop();
    // Creada a mano para que una coleccion vacia tambien reaparezca.
    await db.createCollection(nombre);

    const docs = copia.documentos.get(nombre) || [];
    // Se insertan por lotes: un insertMany de todo cabria, pero asi no se
    // dispara el limite de 16 MB de mensaje si algun dia crece.
    for (let i = 0; i < docs.length; i += 500) {
      await coleccion.insertMany(docs.slice(i, i + 500), { ordered: true });
    }

    // Los indices (unicos, parciales, 2dsphere) van despues de los datos
    // y sin el _id, que Mongo crea solo. `v` y `ns` son del servidor de
    // origen y no se pasan.
    const especificaciones = (copia.indices.get(nombre) || [])
      .filter((i) => i.name !== '_id_')
      .map(({ v, ns, ...resto }) => resto);
    if (especificaciones.length > 0) await coleccion.createIndexes(especificaciones);

    resumen[nombre] = docs.length;
  }

  return resumen;
};
