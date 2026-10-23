import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { volcarBase, leerCopia, restaurarCopia, nombreDeCopia } from '../src/utils/copiaSeguridad.js';

let mongo;
let origen;
let destino;

before(async () => {
  mongo = await MongoMemoryServer.create();
  origen = await mongoose.createConnection(mongo.getUri('origen')).asPromise();
  destino = await mongoose.createConnection(mongo.getUri('destino')).asPromise();
});

after(async () => {
  await origen.close();
  await destino.close();
  await mongo.stop();
});

const oid = new mongoose.Types.ObjectId();
const fecha = new Date('2026-01-02T03:04:05Z');

test('volcar y restaurar da documentos idénticos, con ObjectId y fechas como tipos reales', async () => {
  await origen.db.collection('posts').insertMany([
    { _id: oid, titulo: 'Ñandú ✓', fecha, n: 3, ref: new mongoose.Types.ObjectId(), anidado: { x: [1, 2, { y: null }] } },
    { titulo: 'segundo', fecha },
  ]);
  await origen.db.createCollection('vacia');

  const { buffer, colecciones } = await volcarBase(origen.db);
  assert.deepEqual(colecciones, { posts: 2, vacia: 0 });

  await restaurarCopia(destino.db, leerCopia(buffer));

  const original = await origen.db.collection('posts').find().sort({ _id: 1 }).toArray();
  const restaurado = await destino.db.collection('posts').find().sort({ _id: 1 }).toArray();
  assert.deepEqual(restaurado, original);
  assert.ok(restaurado.find((d) => d._id.equals(oid)).fecha instanceof Date);
  assert.ok((await destino.db.listCollections().toArray()).some((c) => c.name === 'vacia'));
});

test('los índices únicos, parciales y geoespaciales sobreviven a la restauración', async () => {
  await origen.db.collection('usuarios').createIndex({ email: 1 }, { unique: true });
  await origen.db.collection('usuarios').insertOne({ email: 'a@b.c' });
  await origen.db.collection('posts').createIndex({ fecha: -1 }, { partialFilterExpression: { n: { $exists: true } } });
  await origen.db.collection('lugares').createIndex({ ubicacion: '2dsphere' });
  await origen.db.collection('lugares').insertOne({ ubicacion: { type: 'Point', coordinates: [-7.2, 37.2] } });

  const { buffer } = await volcarBase(origen.db);
  const otra = await mongoose.createConnection(mongo.getUri('destino_indices')).asPromise();
  try {
    await restaurarCopia(otra.db, leerCopia(buffer));

    const indices = async (conexion, coleccion) => (await conexion.db.collection(coleccion).indexes()).map((i) => i.name).sort();
    for (const c of ['posts', 'usuarios', 'lugares']) {
      assert.deepEqual(await indices(otra, c), await indices(origen, c), c);
    }
    const unico = (await otra.db.collection('usuarios').indexes()).find((i) => i.name !== '_id_');
    assert.equal(unico.unique, true);
    await assert.rejects(() => otra.db.collection('usuarios').insertOne({ email: 'a@b.c' }), 'el índice único vuelve a proteger');
  } finally {
    await otra.close();
  }
});

test('restaurar no pisa una colección que ya tiene datos, salvo que se pida', async () => {
  const { buffer } = await volcarBase(origen.db);
  const copia = leerCopia(buffer);

  await assert.rejects(() => restaurarCopia(destino.db, copia), /ya tiene datos/);

  await restaurarCopia(destino.db, copia, { vaciar: true });
  assert.equal(await destino.db.collection('posts').countDocuments(), 2);
});

test('un fichero que no es una copia se rechaza con un mensaje claro', async () => {
  const zlib = await import('node:zlib');
  const basura = zlib.gzipSync('{"no":"es una copia"}\n');
  assert.throws(() => leerCopia(basura), /cabecera/);
});

test('el nombre de la copia lleva la fecha, se ordena por orden cronológico y es seguro en una URL', () => {
  const antes = nombreDeCopia(new Date('2026-10-23T04:00:00Z'));
  const despues = nombreDeCopia(new Date('2026-10-24T04:00:00Z'));
  assert.equal(antes, 'milepe-2026-10-23T04-00-00Z.ejsonl.gz');
  assert.ok(antes < despues);
  assert.match(antes, /^[A-Za-z0-9._-]+$/);
});
