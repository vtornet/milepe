// Pasa las amistades a seguimientos. Amistad ya no existe en el codigo
// (la sustituye Seguimiento), pero su coleccion sigue en la base de datos
// con lo que hubiera dentro.
//
// Uso: node scripts/migrar-amistades-a-seguimientos.mjs [--borrar]
//
// Como se traduce:
//
// - amistad 'aceptada'  -> DOS seguimientos, uno en cada sentido. Eran
//   amigos, asi que se siguen mutuamente, que es lo que mantiene abierta
//   su conversacion privada. Sin esto, dos vecinos que llevaban meses
//   escribiendose se encontrarian el hilo en solo lectura de un dia para
//   otro.
// - solicitud 'pendiente' -> UN seguimiento, del que la envio al que la
//   recibio. Es la traduccion fiel: quien la envio queria la relacion y
//   ahora eso se llama seguir; y el que la recibio no tiene que aprobar
//   nada, solo seguirle de vuelta si quiere. Descartarlas habria sido
//   tirar una intencion que alguien expreso.
//
// Idempotente: los seguimientos se crean con upsert sobre el par
// (seguidor, seguido), asi que ejecutarlo dos veces no duplica nada y no
// pisa seguimientos creados despues a mano.
//
// NO borra la coleccion vieja salvo que se pase --borrar, y eso es a
// proposito: mientras siga ahi, esto se puede volver a ejecutar y se
// puede auditar que salio de donde.
import 'dotenv/config';
import mongoose from 'mongoose';
import conectarDB from '../src/config/db.js';
import Seguimiento from '../src/models/Seguimiento.js';

const COLECCION_VIEJA = 'amistads'; // el plural que le puso Mongoose a 'Amistad'

const anotar = (texto) => console.log(texto);

const seguir = async (seguidorId, seguidoId) => {
  // Sin el modelo entero: updateOne con upsert sobre el par, que es el
  // indice unico. Asi no hace falta leer antes para saber si existe.
  const resultado = await Seguimiento.updateOne(
    { seguidor_id: seguidorId, seguido_id: seguidoId },
    { $setOnInsert: { seguidor_id: seguidorId, seguido_id: seguidoId, fecha_creacion: new Date() } },
    { upsert: true },
  );

  return resultado.upsertedCount === 1;
};

const migrar = async () => {
  await conectarDB();

  const colecciones = await mongoose.connection.db
    .listCollections({ name: COLECCION_VIEJA })
    .toArray();

  if (colecciones.length === 0) {
    anotar(`No hay coleccion "${COLECCION_VIEJA}": no habia ninguna amistad que migrar.`);
    await mongoose.disconnect();
    return;
  }

  const amistades = await mongoose.connection.db.collection(COLECCION_VIEJA).find({}).toArray();

  if (amistades.length === 0) {
    anotar(`La coleccion "${COLECCION_VIEJA}" esta vacia: nada que migrar.`);
  }

  let aceptadas = 0;
  let pendientes = 0;
  let creados = 0;
  let saltados = 0;

  for (const amistad of amistades) {
    const { solicitante_id, receptor_id, estado } = amistad;

    if (!solicitante_id || !receptor_id) {
      anotar(`! Fila ${amistad._id} sin solicitante o receptor: se salta.`);
      saltados += 1;
      continue;
    }

    if (await seguir(solicitante_id, receptor_id)) creados += 1;

    if (estado === 'aceptada') {
      aceptadas += 1;
      if (await seguir(receptor_id, solicitante_id)) creados += 1;
    } else {
      pendientes += 1;
    }
  }

  anotar('');
  anotar(`Amistades leidas:        ${amistades.length}`);
  anotar(`  aceptadas (2 sentidos): ${aceptadas}`);
  anotar(`  pendientes (1 sentido): ${pendientes}`);
  if (saltados > 0) anotar(`  saltadas (datos incompletos): ${saltados}`);
  anotar(`Seguimientos creados:    ${creados}`);
  anotar(`Seguimientos totales:    ${await Seguimiento.countDocuments()}`);

  if (process.argv.includes('--borrar')) {
    await mongoose.connection.db.collection(COLECCION_VIEJA).drop();
    anotar(`\nColeccion "${COLECCION_VIEJA}" borrada.`);
  } else if (amistades.length > 0) {
    anotar(`\nLa coleccion "${COLECCION_VIEJA}" se queda como estaba. Para borrarla,`);
    anotar('vuelve a ejecutar esto con --borrar cuando hayas comprobado el resultado.');
  }

  await mongoose.disconnect();
};

migrar().catch(async (error) => {
  console.error('Fallo la migracion:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
