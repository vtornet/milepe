import Post, { ESTADOS_MODERACION } from '../models/Post.js';
import Comentario from '../models/Comentario.js';
import ErrorHttp from '../utils/ErrorHttp.js';

// Un post 'eliminado' es borrado logico: para cualquiera que no sea su
// autor o un moderador, se comporta como si no existiera.
const noEsVisible = (post) => !post || post.estado_moderacion === 'eliminado';

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

// Da o quita el "me gusta" del usuario autenticado. Toggle: la misma
// llamada sirve para dar y para quitar.
export const alternarLike = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (noEsVisible(post)) {
      throw new ErrorHttp(404, 'Publicacion no encontrada');
    }

    post.alternarLike(req.usuario._id);
    await post.save();

    res.json({ ok: true, num_likes: post.likes.length, le_gusta: post.likes.some((id) => id.equals(req.usuario._id)) });
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

    const comentario = await Comentario.create({
      post_id: post._id,
      autor_id: req.usuario._id,
      texto,
      valoracion,
    });

    await comentario.populate('autor_id', 'nombre_usuario nombre avatar_url');

    res.status(201).json({ ok: true, comentario });
  } catch (error) {
    next(error);
  }
};
