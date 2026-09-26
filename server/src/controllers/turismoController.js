import Post from '../models/Post.js';
import TurismoDetalle, { CATEGORIAS_TURISMO } from '../models/TurismoDetalle.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { aPuntoGeoJSON, deGeoJSONaLatLng } from '../utils/geo.js';

const formatearTurismo = (post, detalle) => ({
  _id: post._id,
  titulo: post.titulo,
  contenido: post.contenido,
  imagenes: post.imagenes,
  reacciones: post.reacciones_resumen,
  num_comentarios: post.num_comentarios,
  fecha_creacion: post.fecha_creacion,
  autor: post.autor_id,
  categoria: detalle.categoria,
  ubicacion: deGeoJSONaLatLng(detalle.ubicacion),
});

// Crea el Post (tipo 'turismo') y su TurismoDetalle. Misma compensacion
// sin transacciones que el resto de secciones. ubicacion es opcional
// (como en Eventos): solo se convierte a GeoJSON si vino.
export const crearTurismo = async (req, res, next) => {
  let post;

  try {
    const { titulo, contenido, imagenes, categoria, ubicacion } = req.body;

    post = await Post.create({
      autor_id: req.usuario._id,
      tipo: 'turismo',
      titulo,
      contenido,
      imagenes,
    });

    const detalle = await TurismoDetalle.create({
      post_id: post._id,
      categoria,
      ubicacion: ubicacion ? aPuntoGeoJSON(ubicacion) : undefined,
    });

    await post.populate('autor_id', 'nombre_usuario nombre avatar_url');

    res.status(201).json({ ok: true, turismo: formatearTurismo(post, detalle) });
  } catch (error) {
    if (post) await Post.deleteOne({ _id: post._id });
    next(error);
  }
};

// Listado publico. Igual que en Negocios, empieza por TurismoDetalle (no
// por Post) para poder usar $geoNear como primera etapa del pipeline
// cuando se piden lat/lng (ver CLAUDE.md, nota en el patron Post+*_detalle).
// Sin busqueda por cercania, orden por fecha de publicacion (no hay
// concepto de "destacado" aqui, a diferencia de Negocios).
export const listarTurismo = async (req, res, next) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 20));

    if (req.query.categoria && !CATEGORIAS_TURISMO.includes(req.query.categoria)) {
      throw new ErrorHttp(400, `categoria debe ser una de: ${CATEGORIAS_TURISMO.join(', ')}`);
    }

    const lat = req.query.lat !== undefined ? parseFloat(req.query.lat) : null;
    const lng = req.query.lng !== undefined ? parseFloat(req.query.lng) : null;
    const hayGeo = lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng);
    const radioKm = req.query.radioKm ? parseFloat(req.query.radioKm) : null;

    const pipeline = [];

    if (hayGeo) {
      pipeline.push({
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distancia_metros',
          spherical: true,
          ...(radioKm ? { maxDistance: radioKm * 1000 } : {}),
        },
      });
    }

    pipeline.push(
      { $lookup: { from: 'posts', localField: 'post_id', foreignField: '_id', as: 'post' } },
      { $unwind: '$post' },
      { $match: { 'post.estado_moderacion': 'publicado' } },
    );

    if (req.query.categoria) pipeline.push({ $match: { categoria: req.query.categoria } });

    if (!hayGeo) {
      pipeline.push({ $sort: { 'post.fecha_creacion': -1 } });
    }

    pipeline.push(
      { $lookup: { from: 'usuarios', localField: 'post.autor_id', foreignField: '_id', as: 'autor' } },
      { $unwind: '$autor' },
      {
        $facet: {
          items: [
            { $skip: (pagina - 1) * limite },
            { $limit: limite },
            {
              $project: {
                _id: '$post._id',
                titulo: '$post.titulo',
                contenido: '$post.contenido',
                imagenes: '$post.imagenes',
                num_comentarios: '$post.num_comentarios',
                fecha_creacion: '$post.fecha_creacion',
                reacciones: '$post.reacciones_resumen',
                categoria: 1,
                ubicacion: 1,
                distancia_metros: 1,
                autor: { _id: '$autor._id', nombre_usuario: '$autor.nombre_usuario', nombre: '$autor.nombre', avatar_url: '$autor.avatar_url' },
              },
            },
          ],
          total: [{ $count: 'valor' }],
        },
      },
    );

    const [resultado] = await TurismoDetalle.aggregate(pipeline);
    const total = resultado.total[0]?.valor || 0;
    const items = resultado.items.map((item) => ({ ...item, ubicacion: deGeoJSONaLatLng(item.ubicacion) }));

    res.json({
      ok: true,
      turismo: items,
      paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerTurismo = async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, tipo: 'turismo' }).populate(
      'autor_id',
      'nombre_usuario nombre avatar_url',
    );

    if (!post || post.estado_moderacion === 'eliminado') {
      throw new ErrorHttp(404, 'Contenido de turismo no encontrado');
    }

    const detalle = await TurismoDetalle.findOne({ post_id: post._id });
    if (!detalle) {
      throw new ErrorHttp(404, 'Contenido de turismo no encontrado');
    }

    res.json({ ok: true, turismo: formatearTurismo(post, detalle) });
  } catch (error) {
    next(error);
  }
};
