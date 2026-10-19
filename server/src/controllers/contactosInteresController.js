import ContactoInteres, { CATEGORIAS_CONTACTO } from '../models/ContactoInteres.js';
import ErrorHttp from '../utils/ErrorHttp.js';

// Campos que un admin puede fijar al crear/editar. Nunca se pasa req.body
// entero (misma disciplina que authController.registrar).
const CAMPOS_EDITABLES = [
  'nombre',
  'categoria',
  'telefono',
  'telefono_alternativo',
  'whatsapp',
  'direccion',
  'horario',
  'orden',
  'activo',
];

const soloCamposEditables = (cuerpo) =>
  Object.fromEntries(Object.entries(cuerpo).filter(([clave]) => CAMPOS_EDITABLES.includes(clave)));

// Publico: la ficha tal y como la ve un vecino. Solo contactos activos,
// agrupados por categoria y en el orden que haya fijado el admin.
export const listarContactos = async (req, res, next) => {
  try {
    if (req.query.categoria && !CATEGORIAS_CONTACTO.includes(req.query.categoria)) {
      throw new ErrorHttp(400, `categoria debe ser una de: ${CATEGORIAS_CONTACTO.join(', ')}`);
    }

    const filtro = { activo: true };
    if (req.query.categoria) filtro.categoria = req.query.categoria;

    const contactos = await ContactoInteres.find(filtro).sort({ categoria: 1, orden: 1, nombre: 1 });

    res.json({ ok: true, contactos });
  } catch (error) {
    next(error);
  }
};

// Solo admin: incluye tambien los inactivos, que es justo lo que hace falta
// para poder reactivar uno. Ruta aparte (/todos) en vez de un
// ?incluirInactivos en la publica, para no tener que montar autenticacion
// opcional en una ruta que es publica por defecto.
export const listarTodosLosContactos = async (req, res, next) => {
  try {
    const contactos = await ContactoInteres.find().sort({ categoria: 1, orden: 1, nombre: 1 });
    res.json({ ok: true, contactos });
  } catch (error) {
    next(error);
  }
};

export const crearContacto = async (req, res, next) => {
  try {
    const contacto = await ContactoInteres.create(soloCamposEditables(req.body));
    res.status(201).json({ ok: true, contacto });
  } catch (error) {
    next(error);
  }
};

export const actualizarContacto = async (req, res, next) => {
  try {
    const contacto = await ContactoInteres.findById(req.params.id);
    if (!contacto) {
      throw new ErrorHttp(404, 'Contacto no encontrado');
    }

    Object.assign(contacto, soloCamposEditables(req.body));
    await contacto.save();

    res.json({ ok: true, contacto });
  } catch (error) {
    next(error);
  }
};

// Borrado de verdad, no logico: para "ocultar sin perder los datos" ya
// esta el campo activo. Esto es para una ficha que se metio por error o
// que corresponde a un servicio que ya no existe.
export const eliminarContacto = async (req, res, next) => {
  try {
    const resultado = await ContactoInteres.deleteOne({ _id: req.params.id });

    if (resultado.deletedCount === 0) {
      throw new ErrorHttp(404, 'Contacto no encontrado');
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
