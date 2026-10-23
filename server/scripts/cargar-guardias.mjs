// Carga el calendario de guardias de farmacia de UN MES desde un fichero de
// texto, con el mismo formato (y el mismo codigo) que el cargador de la zona
// de administracion de /farmacias: lineas con fecha o patron semanal
// ("L-V;Farmacia;9:30-22:00", "todos;Farmacia;24h", "festivo;12/10/2026").
// Ver client/src/utils/calendarioGuardias.js.
//
// SUSTITUYE el calendario entero de ese mes, y valida todo antes de escribir:
// si una farmacia no existe en el directorio o una fecha no es real, no toca
// nada y lo dice.
//
// Los datos de cada mes salen del cuadro que publica el Colegio de
// Farmaceuticos de Huelva (un PDF por localidad y mes).
//
// Uso:
//   node scripts/cargar-guardias.mjs <AAAA-MM> <fichero> [--simular]
//   node scripts/cargar-guardias.mjs 2026-10 scripts/datos/guardias-lepe-2026-10.txt --simular
import 'dotenv/config';
import fs from 'node:fs';
import mongoose from 'mongoose';
import conectarDB from '../src/config/db.js';
import { cargarCalendarioMes } from '../src/utils/cargarGuardias.js';
import { interpretarCalendario } from '../../client/src/utils/calendarioGuardias.js';

const argumentos = process.argv.slice(2);
const simular = argumentos.includes('--simular');
const [mes, fichero] = argumentos.filter((a) => !a.startsWith('--'));

const terminar = async (codigo) => {
  await mongoose.disconnect().catch(() => {});
  process.exit(codigo);
};

try {
  if (!mes || !fichero) {
    throw new Error('Uso: node scripts/cargar-guardias.mjs <AAAA-MM> <fichero> [--simular]');
  }

  const { guardias, errores } = interpretarCalendario(fs.readFileSync(fichero, 'utf8'), mes);
  if (errores.length > 0) {
    throw new Error(`Hay lineas que no se entienden:\n  - ${errores.join('\n  - ')}`);
  }

  await conectarDB();
  const resultado = await cargarCalendarioMes(mes, guardias, { simular });

  console.log(
    simular
      ? `[guardias] SIMULACION: ${resultado.guardias} guardias de ${mes} serian validas. No se ha escrito nada.`
      : `[guardias] ${mes}: calendario cargado, ${resultado.guardias} guardias.`,
  );
  await terminar(0);
} catch (error) {
  console.error('[guardias] Error:', error.message);
  await terminar(1);
}
