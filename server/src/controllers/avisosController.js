import Post from '../models/Post.js';
import AvisoDetalle, { CATEGORIAS_AVISO } from '../models/AvisoDetalle.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { CAMPOS_PUBLICOS_USUARIO } from '../models/constantes.js';
import { avisarATodosPorPush } from '../utils/push.js';

const formatearAviso = (post, detalle) => ({
  _id: post._id,
  titulo: post.titulo,
  contenido: post.contenido,
  imagenes: post.imagenes,
  reacciones: post.reacciones_resumen,
  editado: post.editado,
  editado_en: post.editado_en,
  revision_pendiente: post.revision_pendiente,
  num_comentarios: post.num_comentarios,
  fecha_creacion: post.fecha_creacion,
  autor: post.autor_id,
  categoria: detalle.categoria,
  vigente_hasta: detalle.vigente_hasta,
  vigente: detalle.estaVigente(),
  urgente: detalle.urgente,
});

// Publicar un aviso es lo que distingue a una cuenta oficial: un vecino no
// puede hacerse pasar por el Ayuntamiento publicando aqui. Un admin tambien
// puede, para cubrir el caso de que la cuenta oficial no este dada de alta.
export const exigeCuentaOficial = (req, res, next) => {
  if (req.usuario?.oficial || req.usuario?.rol === 'admin') return next();
  return next(new ErrorHttp(403, 'Solo una cuenta oficial puede publicar avisos'));
};

// Mismo patron de compensacion sin transacciones que el resto de secciones.
export const crearAviso = async (req, res, next) => {
  let post;

  try {
    const { titulo, contenido, imagenes, categoria, vigente_hasta, urgente } = req.body;

    if (urgente !== undefined && typeof urgente !== 'boolean') throw new ErrorHttp(400, 'urgente debe ser true o false');
    if (vigente_hasta && Number.isNaN(new Date(vigente_hasta).getTime())) {
      throw new ErrorHttp(400, 'vigente_hasta no es una fecha válida');
    }

    post = await Post.create({ autor_id: req.usuario._id, tipo: 'aviso', titulo, contenido, imagenes });
    const detalle = await AvisoDetalle.create({
      post_id: post._id,
      categoria,
      vigente_hasta: vigente_hasta || null,
      urgente: urgente === true,
    });

    await post.populate('autor_id', CAMPOS_PUBLICOS_USUARIO);
    res.status(201).json({ ok: true, aviso: formatearAviso(post, detalle) });

    // Sin await: la respuesta no espera a cientos de envios, y
    // avisarATodosPorPush nunca lanza.
    if (detalle.urgente) {
      const cuerpo = post.contenido.length > 140 ? `${post.contenido.slice(0, 139)}…` : post.contenido;
      avisarATodosPorPush({ titulo: `Aviso urgente: ${post.titulo}`, cuerpo, ruta: `/p/${post._id}`, etiqueta: `aviso-${post._id}` });
    }
  } catch (error) {
    if (post) await Post.deleteOne({ _id: post._id });
    next(error);
  }
};

// Por defecto solo los vigentes, los mas recientes primero;
// ?incluirCaducados=true trae tambien los vencidos. Sin agregacion: los
// avisos son pocos, asi que se leen los ultimos y se filtran en memoria.
const TOPE_LECTURA = 200;

export const listarAvisos = async (req, res, next) => {
  try {
    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 20));
    const incluirCaducados = req.query.incluirCaducados === 'true';

    if (req.query.categoria && !CATEGORIAS_AVISO.includes(req.query.categoria)) {
      throw new ErrorHttp(400, `categoria debe ser una de: ${CATEGORIAS_AVISO.join(', ')}`);
    }

    const posts = await Post.find({ tipo: 'aviso', estado_moderacion: 'publicado' })
      .sort({ fecha_creacion: -1 })
      .limit(TOPE_LECTURA)
      .populate('autor_id', CAMPOS_PUBLICOS_USUARIO);

    const detalles = await AvisoDetalle.find({ post_id: { $in: posts.map((p) => p._id) } });
    const porPost = new Map(detalles.map((d) => [String(d.post_id), d]));

    const avisos = posts
      .filter((p) => porPost.has(String(p._id)))
      .map((p) => formatearAviso(p, porPost.get(String(p._id))))
      .filter((a) => (incluirCaducados || a.vigente) && (!req.query.categoria || a.categoria === req.query.categoria))
      .slice(0, limite);

    res.json({ ok: true, avisos });
  } catch (error) {
    next(error);
  }
};

export const obtenerAviso = async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, tipo: 'aviso', estado_moderacion: 'publicado' }).populate(
      'autor_id',
      CAMPOS_PUBLICOS_USUARIO,
    );
    const detalle = post && (await AvisoDetalle.findOne({ post_id: post._id }));
    if (!detalle) throw new ErrorHttp(404, 'Aviso no encontrado');

    res.json({ ok: true, aviso: formatearAviso(post, detalle) });
  } catch (error) {
    next(error);
  }
};
