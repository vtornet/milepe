import mongoose from 'mongoose';
import Post from '../models/Post.js';
import QuejaDetalle, { CATEGORIAS_QUEJA, ESTADOS_QUEJA } from '../models/QuejaDetalle.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { aPuntoGeoJSON, deGeoJSONaLatLng } from '../utils/geo.js';

// Post y QuejaDetalle se muestran siempre juntos de cara al cliente: esta
// funcion los combina en una sola forma consistente, la use el create, el
// listado (via agregacion) o el detalle (via populate).
const formatearQueja = (post, detalle) => ({
  _id: post._id,
  titulo: post.titulo,
  contenido: post.contenido,
  imagenes: post.imagenes,
  num_likes: post.likes.length,
  num_comentarios: post.num_comentarios,
  fecha_creacion: post.fecha_creacion,
  autor: post.autor_id,
  categoria: detalle.categoria,
  ubicacion: deGeoJSONaLatLng(detalle.ubicacion),
  direccion_aproximada: detalle.direccion_aproximada,
  estado: detalle.estado,
  historial_estados: detalle.historial_estados,
  fecha_resolucion: detalle.fecha_resolucion,
});

// Crea el Post (tipo 'queja') y su QuejaDetalle. Mongo aqui es un unico
// nodo sin replica set (asi lo tenemos en Railway), por lo que no hay
// transacciones disponibles: si el detalle falla, se borra a mano el post
// que se acababa de crear para no dejar un post huerfano sin detalle.
export const crearQueja = async (req, res, next) => {
  let post;

  try {
    const { titulo, contenido, imagenes, categoria, ubicacion, direccion_aproximada } = req.body;

    post = await Post.create({
      autor_id: req.usuario._id,
      tipo: 'queja',
      titulo,
      contenido,
      imagenes,
    });

    const detalle = await QuejaDetalle.create({
      post_id: post._id,
      categoria,
      ubicacion: aPuntoGeoJSON(ubicacion),
      direccion_aproximada,
    });

    await post.populate('autor_id', 'nombre_usuario nombre avatar_url');

    res.status(201).json({ ok: true, queja: formatearQueja(post, detalle) });
  } catch (error) {
    if (post) await Post.deleteOne({ _id: post._id });
    next(error);
  }
};

// Listado publico de quejas, con filtro opcional por categoria y/o estado.
// Se hace por agregacion (no por QuejaDetalle.find().populate()) porque la
// paginacion tiene que aplicarse UNA vez sobre el conjunto ya cruzado con
// Post; si se pagina antes de cruzar, una pagina de 20 QuejaDetalle podria
// quedarse con menos de 20 tras descartar las que resultan estar ocultas.
export const listarQuejas = async (req, res, next) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 20));

    if (req.query.categoria && !CATEGORIAS_QUEJA.includes(req.query.categoria)) {
      throw new ErrorHttp(400, `categoria debe ser una de: ${CATEGORIAS_QUEJA.join(', ')}`);
    }
    if (req.query.estado && !ESTADOS_QUEJA.includes(req.query.estado)) {
      throw new ErrorHttp(400, `estado debe ser uno de: ${ESTADOS_QUEJA.join(', ')}`);
    }

    const filtroDetalle = {};
    if (req.query.categoria) filtroDetalle['detalle.categoria'] = req.query.categoria;
    if (req.query.estado) filtroDetalle['detalle.estado'] = req.query.estado;

    const pipeline = [
      { $match: { tipo: 'queja', estado_moderacion: 'publicado' } },
      { $sort: { fecha_creacion: -1 } },
      { $lookup: { from: 'quejadetalles', localField: '_id', foreignField: 'post_id', as: 'detalle' } },
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
                num_likes: { $size: '$likes' },
                categoria: '$detalle.categoria',
                ubicacion: '$detalle.ubicacion',
                direccion_aproximada: '$detalle.direccion_aproximada',
                estado: '$detalle.estado',
                fecha_resolucion: '$detalle.fecha_resolucion',
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
    const items = resultado.items.map((item) => ({ ...item, ubicacion: deGeoJSONaLatLng(item.ubicacion) }));

    res.json({
      ok: true,
      quejas: items,
      paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerQueja = async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, tipo: 'queja' }).populate(
      'autor_id',
      'nombre_usuario nombre avatar_url',
    );

    if (!post || post.estado_moderacion === 'eliminado') {
      throw new ErrorHttp(404, 'Queja no encontrada');
    }

    const detalle = await QuejaDetalle.findOne({ post_id: post._id });
    if (!detalle) {
      throw new ErrorHttp(404, 'Queja no encontrada');
    }

    res.json({ ok: true, queja: formatearQueja(post, detalle) });
  } catch (error) {
    next(error);
  }
};

// Solo moderador/admin (lo exige la ruta). No usa Post.moderarPost: esto
// cambia el estado de tramitacion de la queja (pendiente/en_curso/resuelto),
// no su visibilidad en el feed, que son cosas independientes.
export const cambiarEstadoQueja = async (req, res, next) => {
  try {
    const { estado } = req.body;

    const detalle = await QuejaDetalle.findOne({ post_id: req.params.id });
    if (!detalle) {
      throw new ErrorHttp(404, 'Queja no encontrada');
    }

    detalle.cambiarEstado(estado, req.usuario._id);
    await detalle.save();

    res.json({ ok: true, estado: detalle.estado, historial_estados: detalle.historial_estados });
  } catch (error) {
    if (error instanceof mongoose.Error) return next(error);
    if (error.message?.startsWith('Estado de queja no valido')) {
      return next(new ErrorHttp(400, error.message));
    }
    next(error);
  }
};
