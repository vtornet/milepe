import Grupo, { CATEGORIAS_GRUPO } from '../models/Grupo.js';
import MiembroGrupo from '../models/MiembroGrupo.js';
import PublicacionGrupoDetalle from '../models/PublicacionGrupoDetalle.js';
import Post from '../models/Post.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { CAMPOS_PUBLICOS_USUARIO } from '../models/constantes.js';

const CAMPOS_EDITABLES = ['nombre', 'descripcion', 'categoria'];
const soloCamposEditables = (cuerpo) =>
  Object.fromEntries(Object.entries(cuerpo).filter(([clave]) => CAMPOS_EDITABLES.includes(clave)));

const esAdmin = (usuario) => usuario?.rol === 'admin';

// Un grupo retirado no existe para nadie salvo para un admin (que es quien
// puede devolverlo).
const cargarGrupo = async (id, usuario) => {
  const grupo = await Grupo.findById(id).populate('creador_id', CAMPOS_PUBLICOS_USUARIO);
  if (!grupo || (!grupo.activo && !esAdmin(usuario))) throw new ErrorHttp(404, 'Grupo no encontrado');
  return grupo;
};

const esCreador = (grupo, usuario) => String(grupo.creador_id?._id) === String(usuario._id);
const yaExiste = (error) => error.code === 11000;

export const listarGrupos = async (req, res, next) => {
  try {
    const filtro = { activo: true };
    if (req.query.categoria) {
      if (!CATEGORIAS_GRUPO.includes(req.query.categoria)) {
        throw new ErrorHttp(400, `categoria debe ser una de: ${CATEGORIAS_GRUPO.join(', ')}`);
      }
      filtro.categoria = req.query.categoria;
    }
    const grupos = await Grupo.find(filtro).sort({ num_miembros: -1, nombre: 1 }).limit(200);
    res.json({ ok: true, grupos });
  } catch (error) {
    next(error);
  }
};

// Ids de los grupos en los que está quien pregunta: una petición por carga,
// como mis-reacciones, en vez de un campo calculado en cada listado.
export const listarMisGrupos = async (req, res, next) => {
  try {
    const filas = await MiembroGrupo.find({ usuario_id: req.usuario._id }).select('grupo_id');
    res.json({ ok: true, grupos: filas.map((f) => f.grupo_id) });
  } catch (error) {
    next(error);
  }
};

export const obtenerGrupo = async (req, res, next) => {
  try {
    const grupo = await cargarGrupo(req.params.id, req.usuario);
    const soyMiembro = req.usuario
      ? Boolean(await MiembroGrupo.exists({ grupo_id: grupo._id, usuario_id: req.usuario._id }))
      : false;
    res.json({ ok: true, grupo, soy_miembro: soyMiembro });
  } catch (error) {
    next(error);
  }
};

// Quien lo crea entra como primer miembro. Si guardar la membresía falla,
// se deshace el grupo (sin transacciones, mismo patrón de compensación que
// las secciones).
export const crearGrupo = async (req, res, next) => {
  let grupo;
  try {
    try {
      grupo = await Grupo.create({ ...soloCamposEditables(req.body), creador_id: req.usuario._id, num_miembros: 1 });
    } catch (error) {
      if (yaExiste(error)) throw new ErrorHttp(409, 'Ya hay un grupo con ese nombre');
      throw error;
    }
    await MiembroGrupo.create({ grupo_id: grupo._id, usuario_id: req.usuario._id });
    res.status(201).json({ ok: true, grupo });
  } catch (error) {
    if (grupo && !res.headersSent) await Grupo.deleteOne({ _id: grupo._id });
    next(error);
  }
};

// El creador cambia nombre, descripción y categoría; un admin además puede
// retirarlo o devolverlo (activo).
export const actualizarGrupo = async (req, res, next) => {
  try {
    const grupo = await cargarGrupo(req.params.id, req.usuario);
    if (!esCreador(grupo, req.usuario) && !esAdmin(req.usuario)) {
      throw new ErrorHttp(403, 'Solo quien creó el grupo puede cambiarlo');
    }

    Object.assign(grupo, soloCamposEditables(req.body));
    if (req.body.activo !== undefined) {
      if (!esAdmin(req.usuario)) throw new ErrorHttp(403, 'Solo un administrador puede retirar un grupo');
      if (typeof req.body.activo !== 'boolean') throw new ErrorHttp(400, 'activo debe ser true o false');
      grupo.activo = req.body.activo;
    }
    try {
      await grupo.save();
    } catch (error) {
      if (yaExiste(error)) throw new ErrorHttp(409, 'Ya hay un grupo con ese nombre');
      throw error;
    }
    res.json({ ok: true, grupo });
  } catch (error) {
    next(error);
  }
};

// Unirse es idempotente: un duplicado quiere decir que ya estabas, que es
// lo que se pedía. El contador solo sube si la fila es nueva.
export const unirseAGrupo = async (req, res, next) => {
  try {
    const grupo = await cargarGrupo(req.params.id, req.usuario);
    try {
      await MiembroGrupo.create({ grupo_id: grupo._id, usuario_id: req.usuario._id });
      grupo.num_miembros += 1;
      await Grupo.updateOne({ _id: grupo._id }, { $inc: { num_miembros: 1 } });
    } catch (error) {
      if (!yaExiste(error)) throw error;
    }
    res.json({ ok: true, soy_miembro: true, num_miembros: grupo.num_miembros });
  } catch (error) {
    next(error);
  }
};

export const salirDeGrupo = async (req, res, next) => {
  try {
    const grupo = await cargarGrupo(req.params.id, req.usuario);
    if (esCreador(grupo, req.usuario)) {
      throw new ErrorHttp(400, 'Quien creó el grupo no puede salirse: se quedaría sin nadie que lo lleve');
    }
    const { deletedCount } = await MiembroGrupo.deleteOne({ grupo_id: grupo._id, usuario_id: req.usuario._id });
    if (deletedCount) {
      grupo.num_miembros = Math.max(0, grupo.num_miembros - 1);
      await Grupo.updateOne({ _id: grupo._id, num_miembros: { $gt: 0 } }, { $inc: { num_miembros: -1 } });
    }
    res.json({ ok: true, soy_miembro: false, num_miembros: grupo.num_miembros });
  } catch (error) {
    next(error);
  }
};

export const listarPublicacionesDeGrupo = async (req, res, next) => {
  try {
    const grupo = await cargarGrupo(req.params.id, req.usuario);
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 20));

    const detalles = await PublicacionGrupoDetalle.find({ grupo_id: grupo._id })
      .sort({ fecha_creacion: -1 })
      .skip((pagina - 1) * limite)
      .limit(limite)
      .select('post_id');
    const posts = await Post.find({ _id: { $in: detalles.map((d) => d.post_id) }, estado_moderacion: 'publicado' })
      .sort({ fecha_creacion: -1 })
      .populate('autor_id', CAMPOS_PUBLICOS_USUARIO);

    res.json({ ok: true, posts, pagina, hay_mas: detalles.length === limite });
  } catch (error) {
    next(error);
  }
};

// Solo los miembros publican; leer, cualquiera.
export const publicarEnGrupo = async (req, res, next) => {
  let post;
  try {
    const grupo = await cargarGrupo(req.params.id, req.usuario);
    if (!(await MiembroGrupo.exists({ grupo_id: grupo._id, usuario_id: req.usuario._id }))) {
      throw new ErrorHttp(403, 'Únete al grupo para publicar en él');
    }
    const { titulo, contenido, imagenes } = req.body;
    post = await Post.create({ autor_id: req.usuario._id, tipo: 'grupo', titulo, contenido, imagenes });
    await PublicacionGrupoDetalle.create({ post_id: post._id, grupo_id: grupo._id });
    await post.populate('autor_id', CAMPOS_PUBLICOS_USUARIO);
    res.status(201).json({ ok: true, post });
  } catch (error) {
    if (post && !res.headersSent) await Post.deleteOne({ _id: post._id });
    next(error);
  }
};
