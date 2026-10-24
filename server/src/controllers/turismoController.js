import RecursoTuristico, { SECCIONES_TURISMO } from '../models/RecursoTuristico.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { aPuntoGeoJSON, deGeoJSONaLatLng } from '../utils/geo.js';

// Campos que un admin puede fijar. Nunca se pasa req.body entero (misma
// disciplina que contactosInteresController). `ubicacion` no esta aqui: llega
// como { lat, lng } y se convierte a GeoJSON aparte.
const CAMPOS_EDITABLES = [
  'seccion',
  'titulo',
  'descripcion',
  'imagenes',
  'creditos',
  'direccion',
  'telefono',
  'web',
  'fuente',
  'orden',
  'activo',
];

const soloCamposEditables = (cuerpo) =>
  Object.fromEntries(Object.entries(cuerpo).filter(([clave]) => CAMPOS_EDITABLES.includes(clave)));

// ubicacion: { lat, lng } coloca el punto, null lo quita, ausente no lo toca.
const aplicarUbicacion = (datos, cuerpo) => {
  if (cuerpo.ubicacion === undefined) return;
  datos.ubicacion = cuerpo.ubicacion === null ? null : aPuntoGeoJSON(cuerpo.ubicacion);
};

const paraElCliente = (recurso) => {
  const obj = recurso.toObject();
  return { ...obj, ubicacion: deGeoJSONaLatLng(obj.ubicacion) };
};

const validarSeccion = (seccion) => {
  if (seccion && !SECCIONES_TURISMO.includes(seccion)) {
    throw new ErrorHttp(400, `seccion debe ser una de: ${SECCIONES_TURISMO.join(', ')}`);
  }
};

// Cuantos recursos activos hay en cada seccion: es lo que pintan las
// tarjetas de la pagina de Turismo. Las secciones sin nada salen con 0 en
// vez de faltar, para que el cliente no tenga que rellenar huecos.
export const resumenSecciones = async (req, res, next) => {
  try {
    const [cuentas, portadas] = await Promise.all([
      RecursoTuristico.aggregate([
        { $match: { activo: true } },
        { $group: { _id: '$seccion', total: { $sum: 1 } } },
      ]),
      // Portada de cada seccion: la primera imagen del primer recurso (en el
      // orden del admin) que tenga alguna.
      RecursoTuristico.aggregate([
        { $match: { activo: true, 'imagenes.0': { $exists: true } } },
        { $sort: { orden: 1 } },
        { $group: { _id: '$seccion', portada: { $first: { $arrayElemAt: ['$imagenes', 0] } } } },
      ]),
    ]);
    const porSeccion = Object.fromEntries(cuentas.map((c) => [c._id, c.total]));
    const portadaDe = Object.fromEntries(portadas.map((p) => [p._id, p.portada]));

    res.json({
      ok: true,
      secciones: SECCIONES_TURISMO.map((seccion) => ({
        seccion,
        total: porSeccion[seccion] || 0,
        portada: portadaDe[seccion] || null,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const listarTurismo = async (req, res, next) => {
  try {
    validarSeccion(req.query.seccion);

    const filtro = { activo: true };
    if (req.query.seccion) filtro.seccion = req.query.seccion;

    const recursos = await RecursoTuristico.find(filtro).sort({ orden: 1, titulo: 1 });
    res.json({ ok: true, recursos: recursos.map(paraElCliente) });
  } catch (error) {
    next(error);
  }
};

// Solo admin: incluye los ocultos, que es lo que hace falta para poder
// reactivarlos. Ruta aparte (/todos), como en contactos-interes.
export const listarTodosLosRecursos = async (req, res, next) => {
  try {
    validarSeccion(req.query.seccion);

    const filtro = {};
    if (req.query.seccion) filtro.seccion = req.query.seccion;

    const recursos = await RecursoTuristico.find(filtro).sort({ orden: 1, titulo: 1 });
    res.json({ ok: true, recursos: recursos.map(paraElCliente) });
  } catch (error) {
    next(error);
  }
};

export const obtenerTurismo = async (req, res, next) => {
  try {
    const recurso = await RecursoTuristico.findOne({ _id: req.params.id, activo: true });
    if (!recurso) throw new ErrorHttp(404, 'Recurso turistico no encontrado');

    res.json({ ok: true, recurso: paraElCliente(recurso) });
  } catch (error) {
    next(error);
  }
};

export const crearRecurso = async (req, res, next) => {
  try {
    const datos = soloCamposEditables(req.body);
    aplicarUbicacion(datos, req.body);

    const recurso = await RecursoTuristico.create(datos);
    res.status(201).json({ ok: true, recurso: paraElCliente(recurso) });
  } catch (error) {
    next(error);
  }
};

export const actualizarRecurso = async (req, res, next) => {
  try {
    const recurso = await RecursoTuristico.findById(req.params.id);
    if (!recurso) throw new ErrorHttp(404, 'Recurso turistico no encontrado');

    const datos = soloCamposEditables(req.body);
    aplicarUbicacion(datos, req.body);

    Object.assign(recurso, datos);
    await recurso.save();

    res.json({ ok: true, recurso: paraElCliente(recurso) });
  } catch (error) {
    next(error);
  }
};

// Reordenar una seccion: `ids` es la lista completa de sus recursos (ocultos
// incluidos) en el orden nuevo. Si no coincide exactamente con lo que hay —
// otro admin creo o borro algo mientras tanto— se rechaza en vez de dejar un
// orden a medias.
export const reordenarSeccion = async (req, res, next) => {
  try {
    const { seccion, ids } = req.body;
    if (!SECCIONES_TURISMO.includes(seccion)) throw new ErrorHttp(400, 'Sección no válida');
    if (!Array.isArray(ids) || ids.length === 0) throw new ErrorHttp(400, 'Falta la lista de recursos');

    const actuales = await RecursoTuristico.find({ seccion }).select('_id');
    const existentes = new Set(actuales.map((r) => String(r._id)));
    const pedidos = new Set(ids.map(String));
    if (pedidos.size !== ids.length || pedidos.size !== existentes.size || [...pedidos].some((id) => !existentes.has(id))) {
      throw new ErrorHttp(409, 'La sección ha cambiado; recarga la página y vuelve a ordenar');
    }

    await RecursoTuristico.bulkWrite(
      ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { orden: i } } } })),
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

// Borrado de verdad: para ocultar sin perder los datos ya esta `activo`.
export const eliminarRecurso = async (req, res, next) => {
  try {
    const resultado = await RecursoTuristico.deleteOne({ _id: req.params.id });
    if (resultado.deletedCount === 0) throw new ErrorHttp(404, 'Recurso turistico no encontrado');

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
