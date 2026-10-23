import Farmacia from '../models/Farmacia.js';
import GuardiaFarmacia from '../models/GuardiaFarmacia.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { aPuntoGeoJSON, deGeoJSONaLatLng } from '../utils/geo.js';
import {
  ahoraEnMadrid,
  diaDeGuardia,
  esDiaValido,
  esMesValido,
  horaDeCambio,
  limitesDelMes,
  sumarDias,
} from '../utils/guardiaFarmacia.js';

// Campos que un admin puede fijar. Nunca req.body entero (misma disciplina
// que contactosInteresController). `ubicacion` va aparte: llega como
// { lat, lng } y hay que convertirla.
const CAMPOS_EDITABLES = ['nombre', 'zona', 'direccion', 'telefono', 'horario', 'activa'];

// Tope de filas de un calendario mensual: 31 dias por varias farmacias cada
// uno. Pasarse es casi seguro un fichero equivocado.
const MAX_GUARDIAS_POR_MES = 31 * 6;

const datosDeFarmacia = (cuerpo) => {
  const datos = Object.fromEntries(Object.entries(cuerpo).filter(([clave]) => CAMPOS_EDITABLES.includes(clave)));
  // { lat, lng } coloca el punto, null lo quita, ausente no lo toca.
  if (cuerpo.ubicacion !== undefined) {
    datos.ubicacion = cuerpo.ubicacion === null ? null : aPuntoGeoJSON(cuerpo.ubicacion);
  }
  return datos;
};

const formatearFarmacia = (documento) => {
  const obj = documento.toObject ? documento.toObject() : documento;
  return {
    _id: obj._id,
    nombre: obj.nombre,
    zona: obj.zona,
    direccion: obj.direccion,
    telefono: obj.telefono,
    horario: obj.horario,
    activa: obj.activa,
    ubicacion: deGeoJSONaLatLng(obj.ubicacion),
  };
};

// "Farmacia Pérez " y "farmacia perez" son la misma al pegar un calendario.
const normalizar = (texto) =>
  String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// --- Directorio de farmacias ---

export const listarFarmacias = async (req, res, next) => {
  try {
    const farmacias = await Farmacia.find({ activa: true }).sort({ zona: 1, nombre: 1 });
    res.json({ ok: true, farmacias: farmacias.map(formatearFarmacia) });
  } catch (error) {
    next(error);
  }
};

// Solo admin: incluye las inactivas, que es lo que hace falta para poder
// reactivarlas (misma razon que /todos en contactos).
export const listarTodasLasFarmacias = async (req, res, next) => {
  try {
    const farmacias = await Farmacia.find().sort({ zona: 1, nombre: 1 });
    res.json({ ok: true, farmacias: farmacias.map(formatearFarmacia) });
  } catch (error) {
    next(error);
  }
};

export const crearFarmacia = async (req, res, next) => {
  try {
    const farmacia = await Farmacia.create(datosDeFarmacia(req.body));
    res.status(201).json({ ok: true, farmacia: formatearFarmacia(farmacia) });
  } catch (error) {
    next(error);
  }
};

export const actualizarFarmacia = async (req, res, next) => {
  try {
    const farmacia = await Farmacia.findById(req.params.id);
    if (!farmacia) throw new ErrorHttp(404, 'Farmacia no encontrada');

    Object.assign(farmacia, datosDeFarmacia(req.body));
    await farmacia.save();

    res.json({ ok: true, farmacia: formatearFarmacia(farmacia) });
  } catch (error) {
    next(error);
  }
};

// Una farmacia con guardias asignadas no se borra: dejaria dias del
// calendario apuntando a nada, y el vecino vería un hueco justo donde buscaba
// la de guardia. Para sacarla de circulacion esta `activa: false`.
export const eliminarFarmacia = async (req, res, next) => {
  try {
    const farmacia = await Farmacia.findById(req.params.id);
    if (!farmacia) throw new ErrorHttp(404, 'Farmacia no encontrada');

    if (await GuardiaFarmacia.exists({ farmacia_id: farmacia._id })) {
      throw new ErrorHttp(409, 'Esta farmacia tiene guardias en el calendario. Desactívala en vez de eliminarla.');
    }

    await farmacia.deleteOne();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

// --- Guardias ---

const filasAFarmacias = (filas) =>
  filas
    .filter((fila) => fila.farmacia_id)
    .map((fila) => ({ ...formatearFarmacia(fila.farmacia_id), nota: fila.nota }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

const guardiasDeUnDia = async (dia) => {
  const filas = await GuardiaFarmacia.find({ dia }).populate('farmacia_id');
  return { dia, farmacias: filasAFarmacias(filas) };
};

// Lo que pregunta casi todo el mundo: quien esta de guardia AHORA, y quien
// lo estara en el siguiente relevo. La guardia en curso depende de la hora
// (ver diaDeGuardia): de madrugada es la del dia anterior.
export const guardiaActual = async (req, res, next) => {
  try {
    const ahora = ahoraEnMadrid();
    const dia = diaDeGuardia(ahora);

    const [actual, siguiente, ultima] = await Promise.all([
      guardiasDeUnDia(dia),
      guardiasDeUnDia(sumarDias(dia, 1)),
      // Hasta cuando llega el calendario cargado: permite decir "pendiente de
      // cargar" en vez de "no hay guardia", que es muy distinto de cara a
      // alguien que busca una farmacia abierta.
      GuardiaFarmacia.findOne().sort({ dia: -1 }).select('dia'),
    ]);

    res.json({
      ok: true,
      ahora,
      cambio: horaDeCambio(),
      actual,
      siguiente,
      calendario_hasta: ultima?.dia || null,
    });
  } catch (error) {
    next(error);
  }
};

export const listarGuardiasDelMes = async (req, res, next) => {
  try {
    const mes = req.query.mes || ahoraEnMadrid().dia.slice(0, 7);
    if (!esMesValido(mes)) throw new ErrorHttp(400, 'mes debe tener el formato AAAA-MM');

    const { desde, hasta } = limitesDelMes(mes);
    const filas = await GuardiaFarmacia.find({ dia: { $gte: desde, $lte: hasta } })
      .sort({ dia: 1 })
      .populate('farmacia_id');

    const porDia = new Map();
    for (const fila of filas) {
      if (!porDia.has(fila.dia)) porDia.set(fila.dia, []);
      porDia.get(fila.dia).push(fila);
    }

    res.json({
      ok: true,
      mes,
      dias: [...porDia.entries()].map(([dia, delDia]) => ({ dia, farmacias: filasAFarmacias(delDia) })),
    });
  } catch (error) {
    next(error);
  }
};

// Sustituye TODO el calendario de un mes. Cuerpo:
//   { guardias: [{ dia: '2026-10-03', farmacia: 'Farmacia X' | '<id>', nota? }] }
// La farmacia puede ir por id o por nombre (pegando una lista el admin no
// tiene los ids). Se valida todo ANTES de tocar nada: sin transacciones
// (Mongo es de un solo nodo), un calendario a medio escribir seria peor que
// el anterior.
export const guardarGuardiasDelMes = async (req, res, next) => {
  try {
    const { mes } = req.params;
    if (!esMesValido(mes)) throw new ErrorHttp(400, 'El mes debe tener el formato AAAA-MM');

    const entrada = req.body?.guardias;
    if (!Array.isArray(entrada) || entrada.length === 0) {
      throw new ErrorHttp(400, 'guardias debe ser una lista con al menos una entrada');
    }
    if (entrada.length > MAX_GUARDIAS_POR_MES) {
      throw new ErrorHttp(400, `Demasiadas guardias para un mes (máximo ${MAX_GUARDIAS_POR_MES})`);
    }

    const farmacias = await Farmacia.find();
    const porId = new Map(farmacias.map((f) => [String(f._id), f]));
    const porNombre = new Map(farmacias.map((f) => [normalizar(f.nombre), f]));

    const filas = new Map();
    const diasFuera = [];
    const diasInvalidos = [];
    const desconocidas = new Set();

    for (const item of entrada) {
      const dia = typeof item?.dia === 'string' ? item.dia.trim() : '';
      if (!esDiaValido(dia)) {
        diasInvalidos.push(String(item?.dia));
        continue;
      }
      if (!dia.startsWith(`${mes}-`)) {
        diasFuera.push(dia);
        continue;
      }

      const referencia = String(item.farmacia ?? '').trim();
      const farmacia = porId.get(referencia) || porNombre.get(normalizar(referencia));
      if (!farmacia) {
        desconocidas.add(referencia || '(vacía)');
        continue;
      }

      const nota = typeof item.nota === 'string' && item.nota.trim() ? item.nota.trim().slice(0, 100) : null;
      filas.set(`${dia}|${farmacia._id}`, { dia, farmacia_id: farmacia._id, nota });
    }

    const problemas = [];
    if (diasInvalidos.length) problemas.push(`Fechas no válidas: ${[...new Set(diasInvalidos)].join(', ')}`);
    if (diasFuera.length) problemas.push(`Fechas que no son de ${mes}: ${[...new Set(diasFuera)].join(', ')}`);
    if (desconocidas.size) {
      problemas.push(`Farmacias que no existen en el directorio: ${[...desconocidas].join(', ')}`);
    }
    if (problemas.length) {
      throw Object.assign(new ErrorHttp(400, problemas.join('. ')), { razon: 'calendario_invalido' });
    }

    const { desde, hasta } = limitesDelMes(mes);
    await GuardiaFarmacia.deleteMany({ dia: { $gte: desde, $lte: hasta } });
    await GuardiaFarmacia.insertMany([...filas.values()]);

    res.json({ ok: true, mes, guardias: filas.size });
  } catch (error) {
    next(error);
  }
};

export const vaciarGuardiasDelMes = async (req, res, next) => {
  try {
    const { mes } = req.params;
    if (!esMesValido(mes)) throw new ErrorHttp(400, 'El mes debe tener el formato AAAA-MM');

    const { desde, hasta } = limitesDelMes(mes);
    const { deletedCount } = await GuardiaFarmacia.deleteMany({ dia: { $gte: desde, $lte: hasta } });

    res.json({ ok: true, mes, eliminadas: deletedCount });
  } catch (error) {
    next(error);
  }
};
