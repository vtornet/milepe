// Restaura una copia de seguridad (.ejsonl.gz, ver copia-seguridad.mjs
// descargar) en una base de MongoDB.
//
// Uso:
//   node scripts/restaurar-copia.mjs <fichero> --uri <mongodb://...> [--vaciar]
//
// Es DESTRUCTIVO y por eso tiene tres seguros:
//   - --uri es obligatorio: no se restaura nunca en "la base del .env", que
//     por el tunel es la de produccion.
//   - Si la URI es la misma que MONGODB_URI hay que anadir tambien
//     --si-es-produccion.
//   - Si una coleccion de destino ya tiene datos se aborta, salvo --vaciar
//     (que la borra antes de cargarla).
//
// Para ensayar sin riesgo: levanta un mongod local o apunta --uri a una base
// de prueba nueva (p. ej. mongodb://127.0.0.1:27017/milepe_restaurada).
import 'dotenv/config';
import fs from 'node:fs';
import mongoose from 'mongoose';
import { leerCopia, restaurarCopia } from '../src/utils/copiaSeguridad.js';

const argumentos = process.argv.slice(2);
const valorDe = (bandera) => {
  const i = argumentos.indexOf(bandera);
  return i >= 0 ? argumentos[i + 1] : undefined;
};

const fichero = argumentos.find((a) => !a.startsWith('--') && a !== valorDe('--uri'));
const uri = valorDe('--uri');
const vaciar = argumentos.includes('--vaciar');

try {
  if (!fichero || !uri) {
    throw new Error('Uso: node scripts/restaurar-copia.mjs <fichero> --uri <mongodb://...> [--vaciar]');
  }

  const uriDelEnv = process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.MONGO_URL;
  if (uri === uriDelEnv && !argumentos.includes('--si-es-produccion')) {
    throw new Error('Esa URI es la del .env (produccion por el tunel). Si de verdad quieres, anade --si-es-produccion.');
  }

  const copia = leerCopia(fs.readFileSync(fichero));
  console.log(`Copia del ${copia.cabecera.fecha} (base "${copia.cabecera.base}")`);

  await mongoose.connect(uri);
  console.log(`Restaurando en la base "${mongoose.connection.db.databaseName}"...`);

  const resumen = await restaurarCopia(mongoose.connection.db, copia, { vaciar });
  console.table(resumen);
  console.log('Hecho.');
} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
