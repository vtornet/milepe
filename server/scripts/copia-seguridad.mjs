// Copias de seguridad de MongoDB a mano. Hace lo mismo que el cron de las
// 04:00 (src/jobs/copiaSeguridad.js), mas listar y bajar una al disco.
//
// Uso (desde server/, con el tunel abierto si es contra produccion):
//   node scripts/copia-seguridad.mjs crear
//   node scripts/copia-seguridad.mjs listar
//   node scripts/copia-seguridad.mjs descargar [id] [carpeta]
//       sin id baja la mas reciente; carpeta por defecto: ./copias
//
// Restaurar: node scripts/restaurar-copia.mjs (ver su cabecera).
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import conectarDB from '../src/config/db.js';
import { hacerCopia, listarCopias, descargarCopia, COPIAS_A_GUARDAR } from '../src/utils/copiaSeguridad.js';

const [comando, ...resto] = process.argv.slice(2);

const mostrarTamano = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

try {
  if (comando === 'crear') {
    await conectarDB();
    const copia = await hacerCopia();
    console.log(`Copia subida: ${copia.id} (${mostrarTamano(copia.bytes)}, base "${copia.base}")`);
    console.table(copia.colecciones);
    console.log(`${copia.borradas} copia(s) antigua(s) borrada(s); se conservan ${COPIAS_A_GUARDAR}.`);
  } else if (comando === 'listar') {
    const copias = await listarCopias();
    if (copias.length === 0) console.log('No hay copias.');
    for (const c of copias) console.log(`${c.fecha.toISOString()}  ${mostrarTamano(c.bytes).padStart(10)}  ${c.id}`);
  } else if (comando === 'descargar') {
    const [idPedido, carpeta = 'copias'] = resto;
    const id = idPedido || (await listarCopias())[0]?.id;
    if (!id) throw new Error('No hay copias que descargar');

    const buffer = await descargarCopia(id);
    fs.mkdirSync(carpeta, { recursive: true });
    const destino = path.join(carpeta, path.basename(id));
    fs.writeFileSync(destino, buffer);
    console.log(`Descargada en ${destino} (${mostrarTamano(buffer.length)})`);
  } else {
    console.log('Uso: node scripts/copia-seguridad.mjs crear | listar | descargar [id] [carpeta]');
    process.exitCode = 1;
  }
} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
