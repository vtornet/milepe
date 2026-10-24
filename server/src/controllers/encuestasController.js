import Post from '../models/Post.js';
import EncuestaDetalle from '../models/EncuestaDetalle.js';
import VotoEncuesta from '../models/VotoEncuesta.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { CAMPOS_PUBLICOS_USUARIO } from '../models/constantes.js';

// Los resultados solo se enseñan a quien ya ha votado, a quien la publico, o
// a todos cuando se cierra: verlos antes de votar condiciona el voto.
const formatearEncuesta = (post, detalle, { miVoto = null, verResultados = false } = {}) => {
  const abierta = detalle.estaAbierta();
  const conResultados = !abierta || verResultados || miVoto !== null;
  return {
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
    opciones: detalle.opciones,
    cierra_en: detalle.cierra_en,
    abierta,
    total_votos: detalle.total_votos,
    mi_voto: miVoto,
    votos: conResultados ? detalle.votos : null,
  };
};

const esAutor = (usuario, post) => Boolean(usuario && post.autor_id && String(post.autor_id._id || post.autor_id) === String(usuario._id));

export const crearEncuesta = async (req, res, next) => {
  let post;
  try {
    const { titulo, contenido, opciones, cierra_en } = req.body;
    if (!Array.isArray(opciones)) throw new ErrorHttp(400, 'opciones debe ser una lista');

    post = await Post.create({ autor_id: req.usuario._id, tipo: 'encuesta', titulo, contenido });
    const detalle = await EncuestaDetalle.create({
      post_id: post._id,
      opciones: opciones.map((o) => String(o)),
      cierra_en,
    });

    await post.populate('autor_id', CAMPOS_PUBLICOS_USUARIO);
    res.status(201).json({ ok: true, encuesta: formatearEncuesta(post, detalle, { verResultados: true }) });
  } catch (error) {
    if (post) await Post.deleteOne({ _id: post._id });
    next(error);
  }
};

// Listado publico: abiertas primero (las que cierran antes, antes), luego las
// cerradas recientes. Sin datos de nadie: mi_voto lo da /mis-votos.
export const listarEncuestas = async (req, res, next) => {
  try {
    const posts = await Post.find({ tipo: 'encuesta', estado_moderacion: 'publicado' })
      .sort({ fecha_creacion: -1 })
      .limit(100)
      .populate('autor_id', CAMPOS_PUBLICOS_USUARIO);
    const detalles = await EncuestaDetalle.find({ post_id: { $in: posts.map((p) => p._id) } });
    const porPost = new Map(detalles.map((d) => [String(d.post_id), d]));

    const encuestas = posts
      .filter((p) => porPost.has(String(p._id)))
      .map((p) => formatearEncuesta(p, porPost.get(String(p._id)), { verResultados: esAutor(req.usuario, p) }))
      .sort((a, b) => {
        if (a.abierta !== b.abierta) return a.abierta ? -1 : 1;
        // Abiertas: la que cierra antes, primero. Cerradas: la mas reciente, primero.
        return a.abierta ? new Date(a.cierra_en) - new Date(b.cierra_en) : new Date(b.cierra_en) - new Date(a.cierra_en);
      });

    res.json({ ok: true, encuestas });
  } catch (error) {
    next(error);
  }
};

const cargar = async (id) => {
  const post = await Post.findOne({ _id: id, tipo: 'encuesta', estado_moderacion: 'publicado' }).populate(
    'autor_id',
    CAMPOS_PUBLICOS_USUARIO,
  );
  const detalle = post && (await EncuestaDetalle.findOne({ post_id: post._id }));
  if (!detalle) throw new ErrorHttp(404, 'Encuesta no encontrada');
  return { post, detalle };
};

export const obtenerEncuesta = async (req, res, next) => {
  try {
    const { post, detalle } = await cargar(req.params.id);
    const voto = req.usuario ? await VotoEncuesta.findOne({ post_id: post._id, usuario_id: req.usuario._id }) : null;
    res.json({
      ok: true,
      encuesta: formatearEncuesta(post, detalle, { miVoto: voto ? voto.opcion : null, verResultados: esAutor(req.usuario, post) }),
    });
  } catch (error) {
    next(error);
  }
};

// Mis votos, para marcar las encuestas que ya he votado (como mis-reacciones).
export const misVotos = async (req, res, next) => {
  try {
    const votos = await VotoEncuesta.find({ usuario_id: req.usuario._id }).select('post_id opcion').limit(1000);
    res.json({ ok: true, votos: Object.fromEntries(votos.map((v) => [String(v.post_id), v.opcion])) });
  } catch (error) {
    next(error);
  }
};

// Votar o cambiar el voto. Los contadores se mueven con $inc atomico; el
// indice unico de VotoEncuesta impide votar dos veces con dos peticiones a la
// vez.
export const votar = async (req, res, next) => {
  try {
    const { post, detalle } = await cargar(req.params.id);
    if (!detalle.estaAbierta()) throw new ErrorHttp(409, 'Esta encuesta ya está cerrada');

    const opcion = Number(req.body?.opcion);
    if (!Number.isInteger(opcion) || opcion < 0 || opcion >= detalle.opciones.length) {
      throw new ErrorHttp(400, 'Esa opción no existe');
    }

    const anterior = await VotoEncuesta.findOne({ post_id: post._id, usuario_id: req.usuario._id });
    if (anterior && anterior.opcion !== opcion) {
      const cambiado = await VotoEncuesta.findOneAndUpdate(
        { _id: anterior._id, opcion: anterior.opcion },
        { opcion },
        { new: true },
      );
      if (cambiado) {
        await EncuestaDetalle.updateOne(
          { _id: detalle._id },
          { $inc: { [`votos.${anterior.opcion}`]: -1, [`votos.${opcion}`]: 1 } },
        );
      }
    } else if (!anterior) {
      try {
        await VotoEncuesta.create({ post_id: post._id, usuario_id: req.usuario._id, opcion });
        await EncuestaDetalle.updateOne({ _id: detalle._id }, { $inc: { [`votos.${opcion}`]: 1, total_votos: 1 } });
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }

    const actualizado = await EncuestaDetalle.findById(detalle._id);
    const voto = await VotoEncuesta.findOne({ post_id: post._id, usuario_id: req.usuario._id });
    res.json({ ok: true, encuesta: formatearEncuesta(post, actualizado, { miVoto: voto.opcion }) });
  } catch (error) {
    next(error);
  }
};
