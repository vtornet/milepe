import Post from '../models/Post.js';
import NegocioDetalle, { CATEGORIAS_NEGOCIO } from '../models/NegocioDetalle.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { aPuntoGeoJSON, deGeoJSONaLatLng } from '../utils/geo.js';

const formatearNegocio = (post, detalle) => ({
  _id: post._id,
  titulo: post.titulo,
  contenido: post.contenido,
  imagenes: post.imagenes,
  reacciones: post.reacciones_resumen,
  num_comentarios: post.num_comentarios,
  fecha_creacion: post.fecha_creacion,
  autor: post.autor_id,
  categoria: detalle.categoria,
  direccion: detalle.direccion,
  ubicacion: deGeoJSONaLatLng(detalle.ubicacion),
  telefono: detalle.telefono,
  horario: detalle.horario,
  sitio_web: detalle.sitio_web,
  destacado: detalle.estaDestacado(),
});

// Crea el Post (tipo 'negocio') y su NegocioDetalle. A diferencia de
// Eventos, la ubicacion es obligatoria aqui (igual que en Quejas): un
// directorio sin pin en el mapa pierde su sentido. Mismo patron de
// compensacion sin transacciones si el detalle falla su validacion.
// destacado_hasta no se acepta aqui: eso lo pondra el webhook de Stripe
// cuando se integre el pago de la suscripcion, no la creacion directa.
export const crearNegocio = async (req, res, next) => {
  let post;

  try {
    const { titulo, contenido, imagenes, categoria, direccion, ubicacion, telefono, horario, sitio_web } = req.body;

    post = await Post.create({
      autor_id: req.usuario._id,
      tipo: 'negocio',
      titulo,
      contenido,
      imagenes,
    });

    const detalle = await NegocioDetalle.create({
      post_id: post._id,
      categoria,
      direccion,
      ubicacion: aPuntoGeoJSON(ubicacion),
      telefono,
      horario,
      sitio_web,
    });

    await post.populate('autor_id', 'nombre_usuario nombre avatar_url');

    res.status(201).json({ ok: true, negocio: formatearNegocio(post, detalle) });
  } catch (error) {
    if (post) await Post.deleteOne({ _id: post._id });
    next(error);
  }
};

// Listado publico. Empieza por NegocioDetalle (no por Post, al reves que
// en las demas secciones) porque asi, si se piden lat/lng, $geoNear puede
// ser la primera etapa del pipeline: MongoDB lo exige para usar el indice
// 2dsphere. Sin lat/lng, el orden es destacados primero y despues los mas
// recientes; con lat/lng, el orden lo da la propia distancia.
export const listarNegocios = async (req, res, next) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 20));

    if (req.query.categoria && !CATEGORIAS_NEGOCIO.includes(req.query.categoria)) {
      throw new ErrorHttp(400, `categoria debe ser una de: ${CATEGORIAS_NEGOCIO.join(', ')}`);
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
    if (req.query.soloDestacados === 'true') pipeline.push({ $match: { destacado_hasta: { $gt: new Date() } } });

    if (!hayGeo) {
      // Sin busqueda por cercania: destacados primero, despues los mas
      // recientes. Con busqueda por cercania, el orden ya lo da la
      // distancia (mas cerca primero), no tiene sentido mezclar los dos.
      pipeline.push(
        { $addFields: { _destacado: { $gt: ['$destacado_hasta', new Date()] } } },
        { $sort: { _destacado: -1, 'post.fecha_creacion': -1 } },
      );
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
                direccion: 1,
                ubicacion: 1,
                telefono: 1,
                horario: 1,
                sitio_web: 1,
                distancia_metros: 1,
                destacado: { $gt: ['$destacado_hasta', new Date()] },
                autor: { _id: '$autor._id', nombre_usuario: '$autor.nombre_usuario', nombre: '$autor.nombre', avatar_url: '$autor.avatar_url' },
              },
            },
          ],
          total: [{ $count: 'valor' }],
        },
      },
    );

    const [resultado] = await NegocioDetalle.aggregate(pipeline);
    const total = resultado.total[0]?.valor || 0;
    const items = resultado.items.map((item) => ({ ...item, ubicacion: deGeoJSONaLatLng(item.ubicacion) }));

    res.json({
      ok: true,
      negocios: items,
      paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerNegocio = async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, tipo: 'negocio' }).populate(
      'autor_id',
      'nombre_usuario nombre avatar_url',
    );

    if (!post || post.estado_moderacion === 'eliminado') {
      throw new ErrorHttp(404, 'Negocio no encontrado');
    }

    const detalle = await NegocioDetalle.findOne({ post_id: post._id });
    if (!detalle) {
      throw new ErrorHttp(404, 'Negocio no encontrado');
    }

    res.json({ ok: true, negocio: formatearNegocio(post, detalle) });
  } catch (error) {
    next(error);
  }
};
