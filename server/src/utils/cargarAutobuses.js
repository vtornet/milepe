import fs from 'node:fs';
import LineaAutobus from '../models/LineaAutobus.js';

// Horarios de autobus: el fichero scripts/datos/autobuses.json manda (se copia
// a mano de las webs de Damas y de Autocares Gonca, ver
// scripts/cargar-autobuses.mjs). La API lo sincroniza al arrancar si el
// fichero es mas reciente que lo guardado, asi que actualizar un horario es
// editar el JSON y desplegar: no hace falta abrir el tunel a la base de datos.
const FICHERO = new URL('../../scripts/datos/autobuses.json', import.meta.url);

export const leerFichero = () => JSON.parse(fs.readFileSync(FICHERO, 'utf8'));

// Sustituye cada linea entera por la del fichero (un horario a medio
// actualizar es peor que el viejo completo) y desactiva las que ya no estan.
// Valida todo antes de escribir nada.
export const cargarAutobuses = async ({ revisado, lineas }) => {
  const revisadoEn = new Date(revisado);
  for (const linea of lineas) {
    await new LineaAutobus({ ...linea, revisado_en: revisadoEn }).validate();
  }
  for (const linea of lineas) {
    await LineaAutobus.findOneAndReplace(
      { codigo: linea.codigo },
      { ...linea, activa: true, revisado_en: revisadoEn },
      { upsert: true, runValidators: true },
    );
  }
  const { modifiedCount } = await LineaAutobus.updateMany(
    { codigo: { $nin: lineas.map((l) => l.codigo) }, activa: true },
    { activa: false },
  );
  return { cargadas: lineas.length, desactivadas: modifiedCount };
};

// Al arrancar: solo si el fichero es mas nuevo que lo que hay (o no hay
// nada). Nunca tumba el arranque: sin horarios la pagina lo dice, sin API no
// funciona nada.
export const sincronizarAutobuses = async () => {
  try {
    const datos = leerFichero();
    const masReciente = await LineaAutobus.findOne().sort({ revisado_en: -1 }).select('revisado_en').lean();
    if (masReciente?.revisado_en && masReciente.revisado_en >= new Date(datos.revisado)) return null;
    const resultado = await cargarAutobuses(datos);
    console.log(`[autobuses] Horarios del ${datos.revisado} cargados: ${resultado.cargadas} lineas`);
    return resultado;
  } catch (error) {
    console.error('[autobuses] No se pudieron sincronizar los horarios:', error.message);
    return null;
  }
};
