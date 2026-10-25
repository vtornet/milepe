// Carga a mano los horarios de autobus de scripts/datos/autobuses.json.
//
// Normalmente no hace falta: la API los sincroniza sola al arrancar si el
// fichero es mas reciente (src/utils/cargarAutobuses.js), asi que basta con
// editar el JSON, subir la fecha de "revisado" y desplegar. Esto queda para
// validar el fichero (--simular) o forzar la carga con el tunel abierto.
//
// FUENTES (copiadas a mano en ese JSON):
// - Damas: https://damas-sa.es/rutas-y-horarios/ (tablas de cada linea:
//   lepe-huelva, lepe-sevilla, antilla-huelva, antilla-lepe, antilla-sevilla).
// - Urbano de Lepe (Autocares Gonca):
//   https://www.autocaresgonca.es/servicio-17-urbano-de-lepe
// Las dos webs permiten la consulta (robots.txt). Damas avisa de los cambios
// de horario en su seccion "Última hora".
//
// OJO: con el tunel abierto, MONGODB_URI es la base de PRODUCCION.
//
// Uso: node scripts/cargar-autobuses.mjs [--simular]
import 'dotenv/config';
import mongoose from 'mongoose';
import conectarDB from '../src/config/db.js';
import LineaAutobus from '../src/models/LineaAutobus.js';
import { leerFichero, cargarAutobuses } from '../src/utils/cargarAutobuses.js';

const datos = leerFichero();

if (process.argv.includes('--simular')) {
  for (const linea of datos.lineas) await new LineaAutobus(linea).validate();
  console.log(`${datos.lineas.length} lineas validas (revisadas el ${datos.revisado}).`);
  process.exit(0);
}

await conectarDB();
console.log(await cargarAutobuses(datos));
await mongoose.disconnect();
