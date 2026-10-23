import Farmacia from '../models/Farmacia.js';
import GuardiaFarmacia from '../models/GuardiaFarmacia.js';
import ErrorHttp from './ErrorHttp.js';
import {
  DESDE_POR_DEFECTO,
  HASTA_POR_DEFECTO,
  esDiaValido,
  esHoraFinValida,
  esHoraValida,
  esMesValido,
  limitesDelMes,
} from './guardiaFarmacia.js';

// Tope de filas de un calendario mensual: 31 dias por varias farmacias cada
// uno (en Lepe son 4 al dia). Pasarse es casi seguro un fichero equivocado.
export const MAX_GUARDIAS_POR_MES = 31 * 8;

const normalizar = (texto) =>
  String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Palabras que no distinguen a una farmacia de otra: el cuadro del Colegio
// las escribe "Farmacia Lda. Mª Esperanza Sanchez Martín (C/ Alcalde César
// Barrios, 2)".
const RELLENO = new Set(['farmacia', 'lda', 'ldo', 'dr', 'dra', 'd', 'da', 'dna', 'y', 'e', 'de', 'del', 'la', 'las', 'los', 'ma']);

const palabras = (texto) => (normalizar(texto).match(/[a-z0-9]+/g) || []).filter((p) => !RELLENO.has(p));

const contar = (lista) => {
  const cuentas = new Map();
  for (const p of lista) cuentas.set(p, (cuentas.get(p) || 0) + 1);
  return cuentas;
};

// Busca la farmacia a la que se refiere un texto, que puede ser su id, su
// nombre tal cual o el nombre como lo escribe el cuadro del Colegio (con
// titulo, nombre de pila y direccion). Devuelve { farmacia } o { error }.
//
// Para el nombre libre, vale la farmacia cuyas palabras distintivas (los
// apellidos del directorio) aparecen todas en el texto, contando repeticiones
// ("Sánchez Sánchez" necesita dos "sánchez"). Si hay varias, gana la que
// pide mas palabras; si siguen empatadas, es ambiguo y se rechaza en vez de
// adivinar: asignar una guardia a la farmacia equivocada es peor que parar.
export const resolverFarmacia = (referencia, farmacias) => {
  const texto = String(referencia ?? '').trim();
  if (!texto) return { error: 'vacia' };

  const porId = farmacias.find((f) => String(f._id) === texto);
  if (porId) return { farmacia: porId };

  const exacta = farmacias.find((f) => normalizar(f.nombre) === normalizar(texto));
  if (exacta) return { farmacia: exacta };

  const enTexto = contar(palabras(texto));
  const candidatas = farmacias
    .map((f) => ({ farmacia: f, necesarias: contar(palabras(f.nombre)) }))
    .filter(({ necesarias }) => necesarias.size > 0 && [...necesarias].every(([p, n]) => (enTexto.get(p) || 0) >= n))
    .map((c) => ({ ...c, peso: [...c.necesarias.values()].reduce((a, b) => a + b, 0) }));

  if (candidatas.length === 0) return { error: 'desconocida' };

  const mejor = Math.max(...candidatas.map((c) => c.peso));
  const ganadoras = candidatas.filter((c) => c.peso === mejor);
  if (ganadoras.length > 1) return { error: 'ambigua', entre: ganadoras.map((c) => c.farmacia.nombre) };

  return { farmacia: ganadoras[0].farmacia };
};

// Sustituye TODO el calendario de un mes. `entrada` es una lista de
// { dia: 'AAAA-MM-DD', farmacia, desde?, hasta?, nota? }. Se valida todo ANTES
// de tocar nada: sin transacciones (Mongo es de un solo nodo), un calendario
// a medio escribir seria peor que el anterior. Lo comparten la API y el
// script de carga. Con `simular` valida y cuenta sin escribir.
export const cargarCalendarioMes = async (mes, entrada, { simular = false } = {}) => {
  if (!esMesValido(mes)) throw new ErrorHttp(400, 'El mes debe tener el formato AAAA-MM');

  if (!Array.isArray(entrada) || entrada.length === 0) {
    throw new ErrorHttp(400, 'guardias debe ser una lista con al menos una entrada');
  }
  if (entrada.length > MAX_GUARDIAS_POR_MES) {
    throw new ErrorHttp(400, `Demasiadas guardias para un mes (máximo ${MAX_GUARDIAS_POR_MES})`);
  }

  const farmacias = await Farmacia.find();

  const filas = new Map();
  const diasFuera = new Set();
  const diasInvalidos = new Set();
  const horasInvalidas = new Set();
  const desconocidas = new Set();
  const ambiguas = new Set();

  for (const item of entrada) {
    const dia = typeof item?.dia === 'string' ? item.dia.trim() : '';
    if (!esDiaValido(dia)) {
      diasInvalidos.add(String(item?.dia));
      continue;
    }
    if (!dia.startsWith(`${mes}-`)) {
      diasFuera.add(dia);
      continue;
    }

    const desde = item.desde ?? DESDE_POR_DEFECTO;
    const hasta = item.hasta ?? HASTA_POR_DEFECTO;
    if (!esHoraValida(desde) || !esHoraFinValida(hasta)) {
      horasInvalidas.add(`${desde}-${hasta}`);
      continue;
    }

    const resultado = resolverFarmacia(item.farmacia, farmacias);
    if (resultado.error === 'ambigua') {
      ambiguas.add(`${String(item.farmacia).trim()} (podría ser: ${resultado.entre.join(' o ')})`);
      continue;
    }
    if (resultado.error) {
      desconocidas.add(String(item.farmacia ?? '').trim() || '(vacía)');
      continue;
    }

    const nota = typeof item.nota === 'string' && item.nota.trim() ? item.nota.trim().slice(0, 100) : null;
    filas.set(`${dia}|${resultado.farmacia._id}`, { dia, farmacia_id: resultado.farmacia._id, desde, hasta, nota });
  }

  const problemas = [];
  if (diasInvalidos.size) problemas.push(`Fechas no válidas: ${[...diasInvalidos].join(', ')}`);
  if (diasFuera.size) problemas.push(`Fechas que no son de ${mes}: ${[...diasFuera].join(', ')}`);
  if (horasInvalidas.size) problemas.push(`Horarios no válidos: ${[...horasInvalidas].join(', ')}`);
  if (desconocidas.size) problemas.push(`Farmacias que no existen en el directorio: ${[...desconocidas].join(', ')}`);
  if (ambiguas.size) problemas.push(`Farmacias ambiguas: ${[...ambiguas].join('; ')}`);
  if (problemas.length) {
    throw Object.assign(new ErrorHttp(400, problemas.join('. ')), { razon: 'calendario_invalido' });
  }

  // En una simulacion se valida todo y se cuenta, pero no se escribe nada.
  if (simular) return { guardias: filas.size, simulado: true };

  const { desde, hasta } = limitesDelMes(mes);
  await GuardiaFarmacia.deleteMany({ dia: { $gte: desde, $lte: hasta } });
  await GuardiaFarmacia.insertMany([...filas.values()]);

  return { guardias: filas.size };
};
