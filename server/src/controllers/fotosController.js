import Post from '../models/Post.js';
import FotoDetalle, { EPOCAS_FOTO } from '../models/FotoDetalle.js';
import ErrorHttp from '../utils/ErrorHttp.js';

// Post y FotoDetalle combinados en una sola forma, igual que
// quejasController.formatearQueja.
const formatearFoto = (post, detalle) => ({
  _id: post._id,
  titulo: post.titulo,
  contenido: post.contenido,
  imagenes: post.imagenes,
  reacciones: post.reacciones_resumen,
  num_comentarios: post.num_comentarios,
  fecha_creacion: post.fecha_creacion,
  autor: post.autor_id,
  epoca: detalle.epoca,
  decada: detalle.decada,
});

// Crea el Post (tipo 'foto') y su FotoDetalle. Mismo motivo que en
// quejasController: Mongo en Railway es un nodo unico sin replica set, sin
// transacciones, asi que si el detalle falla se borra a mano el post que
// se acababa de crear.
export const crearFoto = async (req, res, next) => {
  let post;

  try {
    const { titulo, contenido, imagenes, epoca, decada } = req.body;

    if (!Array.isArray(imagenes) || imagenes.length === 0) {
      throw new ErrorHttp(400, 'Hace falta al menos una imagen (sube primero a POST /api/subidas/imagenes)');
    }

    post = await Post.create({
      autor_id: req.usuario._id,
      tipo: 'foto',
      titulo,
      contenido,
      imagenes,
    });

    const detalle = await FotoDetalle.create({ post_id: post._id, epoca, decada });

    await post.populate('autor_id', 'nombre_usuario nombre avatar_url');

    res.status(201).json({ ok: true, foto: formatearFoto(post, detalle) });
  } catch (error) {
    if (post) await Post.deleteOne({ _id: post._id });
    next(error);
  }
};

// Listado publico, con filtro opcional por epoca y (si epoca=antigua)
// por decada. Misma razon que en quejasController.listarQuejas para usar
// agregacion en vez de FotoDetalle.find().populate(): la paginacion tiene
// que aplicarse una vez sobre el conjunto ya cruzado con Post.
export const listarFotos = async (req, res, next) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 20));

    if (req.query.epoca && !EPOCAS_FOTO.includes(req.query.epoca)) {
      throw new ErrorHttp(400, `epoca debe ser una de: ${EPOCAS_FOTO.join(', ')}`);
    }

    const filtroDetalle = {};
    if (req.query.epoca) filtroDetalle['detalle.epoca'] = req.query.epoca;
    if (req.query.decada) filtroDetalle['detalle.decada'] = parseInt(req.query.decada, 10);

    const pipeline = [
      { $match: { tipo: 'foto', estado_moderacion: 'publicado' } },
      { $sort: { fecha_creacion: -1 } },
      { $lookup: { from: 'fotodetalles', localField: '_id', foreignField: 'post_id', as: 'detalle' } },
      { $unwind: '$detalle' },
      ...(Object.keys(filtroDetalle).length ? [{ $match: filtroDetalle }] : []),
      { $lookup: { from: 'usuarios', localField: 'autor_id', foreignField: '_id', as: 'autor' } },
      { $unwind: '$autor' },
      {
        $facet: {
          items: [
            { $skip: (pagina - 1) * limite },
            { $limit: limite },
            {
              $project: {
                _id: 1,
                titulo: 1,
                contenido: 1,
                imagenes: 1,
                num_comentarios: 1,
                fecha_creacion: 1,
                reacciones: '$reacciones_resumen',
                epoca: '$detalle.epoca',
                decada: '$detalle.decada',
                autor: { _id: '$autor._id', nombre_usuario: '$autor.nombre_usuario', nombre: '$autor.nombre', avatar_url: '$autor.avatar_url' },
              },
            },
          ],
          total: [{ $count: 'valor' }],
        },
      },
    ];

    const [resultado] = await Post.aggregate(pipeline);
    const total = resultado.total[0]?.valor || 0;

    res.json({
      ok: true,
      fotos: resultado.items,
      paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerFoto = async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, tipo: 'foto' }).populate(
      'autor_id',
      'nombre_usuario nombre avatar_url',
    );

    if (!post || post.estado_moderacion === 'eliminado') {
      throw new ErrorHttp(404, 'Foto no encontrada');
    }

    const detalle = await FotoDetalle.findOne({ post_id: post._id });
    if (!detalle) {
      throw new ErrorHttp(404, 'Foto no encontrada');
    }

    res.json({ ok: true, foto: formatearFoto(post, detalle) });
  } catch (error) {
    next(error);
  }
};
