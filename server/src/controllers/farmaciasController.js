import Farmacia from '../models/Farmacia.js';
import GuardiaFarmacia from '../models/GuardiaFarmacia.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { aPuntoGeoJSON, deGeoJSONaLatLng } from '../utils/geo.js';
import { cargarCalendarioMes } from '../utils/cargarGuardias.js';
import { ahoraEnMadrid, esMesValido, estaEnCurso, limitesDelMes, sumarDias } from '../utils/guardiaFarmacia.js';

// Campos que un admin puede fijar. Nunca req.body entero (misma disciplina
// que contactosInteresController). `ubicacion` va aparte: llega como
// { lat, lng } y hay que convertirla.
const CAMPOS_EDITABLES = ['nombre', 'zona', 'direccion', 'telefono', 'horario', 'activa'];

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

// Una fila de guardia ya con los datos de su farmacia y su horario.
const filaATurno = (fila) => ({
  ...formatearFarmacia(fila.farmacia_id),
  desde: fila.desde,
  hasta: fila.hasta,
  nota: fila.nota,
});

// Por horario de inicio y, a igualdad, por nombre: asi "24 horas" y las de
// "9:30 a 22:00" salen siempre agrupadas y en el mismo orden.
const ordenar = (turnos) =>
  turnos.sort((a, b) => a.desde.localeCompare(b.desde) || a.hasta.localeCompare(b.hasta) || a.nombre.localeCompare(b.nombre, 'es'));

const turnosDe = (filas) =>
  ordenar(filas.filter((fila) => fila.farmacia_id).map(filaATurno));

// Lo que pregunta casi todo el mundo: quien esta de guardia AHORA, y como
// es el dia de hoy y el de mañana. "Ahora" son las guardias cuya ventana
// horaria esta abierta en este momento (ver estaEnCurso): de madrugada,
// en Lepe, solo la de 24 horas; una farmacia diurna del dia anterior esta
// cerrada y no cuenta.
export const guardiaActual = async (req, res, next) => {
  try {
    const ahora = ahoraEnMadrid();
    const ayer = sumarDias(ahora.dia, -1);
    const manana = sumarDias(ahora.dia, 1);

    const [filas, ultima] = await Promise.all([
      GuardiaFarmacia.find({ dia: { $in: [ayer, ahora.dia, manana] } }).populate('farmacia_id'),
      // Hasta cuando llega el calendario cargado: permite decir "pendiente de
      // cargar" en vez de "no hay guardia", que es muy distinto de cara a
      // alguien que busca una farmacia abierta.
      GuardiaFarmacia.findOne().sort({ dia: -1 }).select('dia'),
    ]);

    res.json({
      ok: true,
      ahora,
      en_curso: turnosDe(filas.filter((fila) => estaEnCurso(fila, ahora))),
      hoy: { dia: ahora.dia, turnos: turnosDe(filas.filter((fila) => fila.dia === ahora.dia)) },
      manana: { dia: manana, turnos: turnosDe(filas.filter((fila) => fila.dia === manana)) },
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
      dias: [...porDia.entries()].map(([dia, delDia]) => ({ dia, turnos: turnosDe(delDia) })),
    });
  } catch (error) {
    next(error);
  }
};

// Sustituye TODO el calendario de un mes. Cuerpo:
//   { guardias: [{ dia: '2026-10-03', farmacia: 'Farmacia X' | '<id>',
//                  desde?: '09:30', hasta?: '22:00', nota? }] }
// La logica (validar todo antes de escribir nada, resolver nombres) vive en
// utils/cargarGuardias.js, porque tambien la usa el script de carga.
export const guardarGuardiasDelMes = async (req, res, next) => {
  try {
    const { mes } = req.params;
    const { guardias } = await cargarCalendarioMes(mes, req.body?.guardias);
    res.json({ ok: true, mes, guardias });
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
