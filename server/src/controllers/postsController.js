import Post, { ESTADOS_MODERACION } from '../models/Post.js';
import Comentario from '../models/Comentario.js';
import Reaccion, { TIPOS_REACCION } from '../models/Reaccion.js';
import Bloqueo from '../models/Bloqueo.js';
import Notificacion from '../models/Notificacion.js';
import ErrorHttp from '../utils/ErrorHttp.js';

// Un post 'eliminado' es borrado logico: para cualquiera que no sea su
// autor o un moderador, se comporta como si no existiera.
const noEsVisible = (post) => !post || post.estado_moderacion === 'eliminado';

// Nunca te notificas a ti mismo (comentar/reaccionar en lo tuyo propio).
// Centralizado aqui porque los tres disparadores de este archivo
// (comentario, reaccion a post, reaccion a comentario) repiten la misma
// comprobacion.
const notificarSiNoEsUnoMismo = async ({ destinatarioId, autorAccionId, ...datos }) => {
  if (destinatarioId.equals(autorAccionId)) return;
  await Notificacion.create({ usuario_id: destinatarioId, ...datos });
};

// Muro: feed general, todas las secciones a la vez, sin joins. Filtro
// opcional por tipo (lo usa cada seccion si alguna vez necesita reutilizar
// este listado en vez de tener el suyo propio con su detalle).
export const listarMuro = async (req, res, next) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 20));

    const filtro = { estado_moderacion: 'publicado' };
    if (req.query.tipo) filtro.tipo = req.query.tipo;

    const [posts, total] = await Promise.all([
      Post.find(filtro)
        .sort({ fecha_creacion: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .populate('autor_id', 'nombre_usuario nombre avatar_url'),
      Post.countDocuments(filtro),
    ]);

    res.json({
      ok: true,
      posts,
      paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate('autor_id', 'nombre_usuario nombre avatar_url');

    if (noEsVisible(post)) {
      throw new ErrorHttp(404, 'Publicacion no encontrada');
    }

    res.json({ ok: true, post });
  } catch (error) {
    next(error);
  }
};

// Da, cambia o quita la reaccion del usuario autenticado sobre un post.
// Toggle: reaccionar otra vez con el mismo tipo la quita; con uno distinto,
// la cambia. body: { tipo: 'me_gusta' | 'me_encanta' | 'apoyo' | 'triste' }.
export const reaccionarPost = async (req, res, next) => {
  try {
    const { tipo } = req.body;

    if (!TIPOS_REACCION.includes(tipo)) {
      throw new ErrorHttp(400, `tipo debe ser uno de: ${TIPOS_REACCION.join(', ')}`);
    }

    const post = await Post.findById(req.params.id);
    if (noEsVisible(post)) {
      throw new ErrorHttp(404, 'Publicacion no encontrada');
    }

    if (await Bloqueo.existeEntre(req.usuario._id, post.autor_id)) {
      throw new ErrorHttp(403, 'No puedes reaccionar a esta publicacion');
    }

    const resultado = await Reaccion.alternar({ autor_id: req.usuario._id, tipo, post_id: post._id });
    const postActualizado = await Post.findById(post._id).select('reacciones_resumen');

    // Quitar una reaccion no notifica nada; solo darla o cambiarla.
    if (resultado.accion !== 'quitada') {
      await notificarSiNoEsUnoMismo({
        destinatarioId: post.autor_id,
        autorAccionId: req.usuario._id,
        tipo: 'reaccion',
        mensaje: `${req.usuario.nombre_usuario} ha reaccionado a tu publicacion`,
        referencia_id: post._id,
        referencia_tipo: 'post',
      });
    }

    res.json({ ok: true, ...resultado, reacciones: postActualizado.reacciones_resumen });
  } catch (error) {
    next(error);
  }
};

export const reportarPost = async (req, res, next) => {
  try {
    const { motivo } = req.body;

    if (!motivo) {
      throw new ErrorHttp(400, 'El motivo del reporte es obligatorio');
    }

    const post = await Post.findById(req.params.id);

    if (noEsVisible(post)) {
      throw new ErrorHttp(404, 'Publicacion no encontrada');
    }

    post.reportar(req.usuario._id, motivo);
    await post.save();

    res.json({ ok: true, estado_moderacion: post.estado_moderacion });
  } catch (error) {
    next(error);
  }
};

// Accion de moderacion generica: vale para cualquier tipo de post, por eso
// vive aqui y no repetida en cada seccion. Solo moderador/admin (lo exige
// la ruta con autorizar(), no este controlador).
export const moderarPost = async (req, res, next) => {
  try {
    const { estado_moderacion } = req.body;

    if (!ESTADOS_MODERACION.includes(estado_moderacion)) {
      throw new ErrorHttp(400, `estado_moderacion debe ser uno de: ${ESTADOS_MODERACION.join(', ')}`);
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      throw new ErrorHttp(404, 'Publicacion no encontrada');
    }

    post.estado_moderacion = estado_moderacion;
    post.moderador_id = req.usuario._id;
    await post.save();

    res.json({ ok: true, post });
  } catch (error) {
    next(error);
  }
};

export const listarComentarios = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (noEsVisible(post)) {
      throw new ErrorHttp(404, 'Publicacion no encontrada');
    }

    const comentarios = await Comentario.find({ post_id: post._id, estado_moderacion: 'publicado' })
      .sort({ fecha_creacion: 1 })
      .populate('autor_id', 'nombre_usuario nombre avatar_url');

    res.json({ ok: true, comentarios });
  } catch (error) {
    next(error);
  }
};

export const crearComentario = async (req, res, next) => {
  try {
    const { texto, valoracion } = req.body;

    const post = await Post.findById(req.params.id);
    if (noEsVisible(post)) {
      throw new ErrorHttp(404, 'Publicacion no encontrada');
    }

    if (await Bloqueo.existeEntre(req.usuario._id, post.autor_id)) {
      throw new ErrorHttp(403, 'No puedes comentar en esta publicacion');
    }

    const comentario = await Comentario.create({
      post_id: post._id,
      autor_id: req.usuario._id,
      texto,
      valoracion,
    });

    await comentario.populate('autor_id', 'nombre_usuario nombre avatar_url');

    await notificarSiNoEsUnoMismo({
      destinatarioId: post.autor_id,
      autorAccionId: req.usuario._id,
      tipo: 'comentario',
      mensaje: `${req.usuario.nombre_usuario} ha comentado en tu publicacion`,
      referencia_id: post._id,
      referencia_tipo: 'post',
    });

    res.status(201).json({ ok: true, comentario });
  } catch (error) {
    next(error);
  }
};

// Igual que reaccionarPost pero sobre un comentario. Vive aqui (no en su
// propia ruta /comentarios) porque comparte el mismo prefijo /:id que el
// resto de acciones sobre un post; el comentario se referencia por su
// propio id en el body, no en la URL.
export const reaccionarComentario = async (req, res, next) => {
  try {
    const { tipo, comentario_id } = req.body;

    if (!TIPOS_REACCION.includes(tipo)) {
      throw new ErrorHttp(400, `tipo debe ser uno de: ${TIPOS_REACCION.join(', ')}`);
    }
    if (!comentario_id) {
      throw new ErrorHttp(400, 'comentario_id es obligatorio');
    }

    const comentario = await Comentario.findOne({ _id: comentario_id, post_id: req.params.id });
    if (!comentario || comentario.estado_moderacion === 'eliminado') {
      throw new ErrorHttp(404, 'Comentario no encontrado');
    }

    const resultado = await Reaccion.alternar({ autor_id: req.usuario._id, tipo, comentario_id });
    const comentarioActualizado = await Comentario.findById(comentario_id).select('reacciones_resumen');

    if (resultado.accion !== 'quitada') {
      await notificarSiNoEsUnoMismo({
        destinatarioId: comentario.autor_id,
        autorAccionId: req.usuario._id,
        tipo: 'reaccion',
        mensaje: `${req.usuario.nombre_usuario} ha reaccionado a tu comentario`,
        referencia_id: comentario.post_id,
        referencia_tipo: 'post',
      });
    }

    res.json({ ok: true, ...resultado, reacciones: comentarioActualizado.reacciones_resumen });
  } catch (error) {
    next(error);
  }
};
