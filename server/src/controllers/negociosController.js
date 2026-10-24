import Post from '../models/Post.js';
import NegocioDetalle, { CATEGORIAS_NEGOCIO } from '../models/NegocioDetalle.js';
import ReclamacionNegocio from '../models/ReclamacionNegocio.js';
import Notificacion from '../models/Notificacion.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { aPuntoGeoJSON, deGeoJSONaLatLng } from '../utils/geo.js';
import { CAMPOS_PUBLICOS_USUARIO } from '../models/constantes.js';

// Una oferta caducada no viaja: es como si no hubiera.
const ofertaVigente = (oferta) => (oferta?.vigente_hasta > new Date() ? oferta : null);

const formatearNegocio = (post, detalle) => ({
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
  direccion: detalle.direccion,
  ubicacion: deGeoJSONaLatLng(detalle.ubicacion),
  telefono: detalle.telefono,
  horario: detalle.horario,
  sitio_web: detalle.sitio_web,
  destacado: detalle.estaDestacado(),
  propietario_id: detalle.propietario_id,
  oferta: ofertaVigente(detalle.oferta),
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

    await post.populate('autor_id', CAMPOS_PUBLICOS_USUARIO);

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
                editado: '$post.editado',
                editado_en: '$post.editado_en',
                revision_pendiente: '$post.revision_pendiente',
                categoria: 1,
                direccion: 1,
                ubicacion: 1,
                telefono: 1,
                horario: 1,
                sitio_web: 1,
                distancia_metros: 1,
                destacado: { $gt: ['$destacado_hasta', new Date()] },
                propietario_id: 1,
                oferta: { $cond: [{ $gt: ['$oferta.vigente_hasta', '$$NOW'] }, '$oferta', null] },
                autor: { _id: '$autor._id', nombre_usuario: '$autor.nombre_usuario', avatar_url: '$autor.avatar_url', oficial: '$autor.oficial' },
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
      CAMPOS_PUBLICOS_USUARIO,
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

// --- Gestion por el propietario ---

// Quien puede tocar la ficha: un admin, el propietario reconocido o, si nadie
// la ha reclamado todavia, quien la publico.
const puedeGestionar = (usuario, post, detalle) =>
  usuario.rol === 'admin' ||
  (detalle.propietario_id ? detalle.propietario_id.equals(usuario._id) : post.autor_id.equals(usuario._id));

const cargarNegocio = async (id) => {
  const post = await Post.findOne({ _id: id, tipo: 'negocio' });
  if (!post || post.estado_moderacion !== 'publicado') throw new ErrorHttp(404, 'Negocio no encontrado');
  const detalle = await NegocioDetalle.findOne({ post_id: post._id });
  if (!detalle) throw new ErrorHttp(404, 'Negocio no encontrado');
  return { post, detalle };
};

const CAMPOS_FICHA = ['categoria', 'direccion', 'telefono', 'horario', 'sitio_web'];

export const editarFicha = async (req, res, next) => {
  try {
    const { post, detalle } = await cargarNegocio(req.params.id);
    if (!puedeGestionar(req.usuario, post, detalle)) {
      throw new ErrorHttp(403, 'Solo el propietario del negocio puede editar su ficha');
    }

    for (const campo of CAMPOS_FICHA) {
      if (req.body[campo] !== undefined) detalle[campo] = req.body[campo] === '' ? null : req.body[campo];
    }
    await detalle.save();

    await post.populate('autor_id', CAMPOS_PUBLICOS_USUARIO);
    res.json({ ok: true, negocio: formatearNegocio(post, detalle) });
  } catch (error) {
    next(error);
  }
};

const MAX_DIAS_OFERTA = 90;

// Una oferta vigente a la vez ("2x1 en cafes hasta el domingo"). Sin texto,
// se quita.
export const guardarOferta = async (req, res, next) => {
  try {
    const { post, detalle } = await cargarNegocio(req.params.id);
    if (!puedeGestionar(req.usuario, post, detalle)) {
      throw new ErrorHttp(403, 'Solo el propietario del negocio puede publicar ofertas');
    }

    const texto = typeof req.body.texto === 'string' ? req.body.texto.trim() : '';
    if (!texto) {
      detalle.oferta = null;
    } else {
      const hasta = new Date(req.body.vigente_hasta);
      const ahora = Date.now();
      if (Number.isNaN(hasta.getTime()) || hasta <= ahora) {
        throw new ErrorHttp(400, 'Indica hasta cuándo vale la oferta (una fecha futura)');
      }
      if (hasta - ahora > MAX_DIAS_OFERTA * 24 * 60 * 60 * 1000) {
        throw new ErrorHttp(400, `Una oferta puede durar como mucho ${MAX_DIAS_OFERTA} días`);
      }
      detalle.oferta = { texto, vigente_hasta: hasta };
    }
    await detalle.save();

    await post.populate('autor_id', CAMPOS_PUBLICOS_USUARIO);
    res.json({ ok: true, negocio: formatearNegocio(post, detalle) });
  } catch (error) {
    next(error);
  }
};

export const reclamarNegocio = async (req, res, next) => {
  try {
    const { detalle } = await cargarNegocio(req.params.id);
    if (detalle.propietario_id?.equals(req.usuario._id)) {
      throw new ErrorHttp(409, 'Ya eres el propietario de este negocio');
    }

    let reclamacion;
    try {
      reclamacion = await ReclamacionNegocio.create({
        post_id: detalle.post_id,
        usuario_id: req.usuario._id,
        mensaje: req.body.mensaje,
      });
    } catch (error) {
      if (error.code === 11000) throw new ErrorHttp(409, 'Ya tienes una reclamación pendiente para este negocio');
      throw error;
    }

    res.status(201).json({ ok: true, reclamacion });
  } catch (error) {
    next(error);
  }
};

// Cola del admin: las pendientes, las mas antiguas primero.
export const listarReclamaciones = async (req, res, next) => {
  try {
    const reclamaciones = await ReclamacionNegocio.find({ estado: req.query.estado || 'pendiente' })
      .sort({ fecha_creacion: 1 })
      .limit(100)
      .populate('usuario_id', CAMPOS_PUBLICOS_USUARIO)
      .populate('post_id', 'titulo autor_id');

    res.json({ ok: true, reclamaciones });
  } catch (error) {
    next(error);
  }
};

export const resolverReclamacion = async (req, res, next) => {
  try {
    const { estado } = req.body;
    if (!['aceptada', 'rechazada'].includes(estado)) {
      throw new ErrorHttp(400, 'estado debe ser aceptada o rechazada');
    }

    const reclamacion = await ReclamacionNegocio.findById(req.params.id);
    if (!reclamacion) throw new ErrorHttp(404, 'Reclamación no encontrada');
    if (reclamacion.estado !== 'pendiente') throw new ErrorHttp(409, 'Esta reclamación ya estaba resuelta');

    const respuesta = typeof req.body.respuesta === 'string' && req.body.respuesta.trim() ? req.body.respuesta.trim() : null;
    const ahora = new Date();
    Object.assign(reclamacion, { estado, revisor_id: req.usuario._id, respuesta, fecha_revision: ahora });
    await reclamacion.save();

    const post = await Post.findById(reclamacion.post_id).select('titulo');

    if (estado === 'aceptada') {
      await NegocioDetalle.updateOne({ post_id: reclamacion.post_id }, { propietario_id: reclamacion.usuario_id });
      // Un negocio tiene un propietario: las demas reclamaciones pendientes
      // sobre el mismo quedan rechazadas.
      await ReclamacionNegocio.updateMany(
        { post_id: reclamacion.post_id, estado: 'pendiente' },
        { estado: 'rechazada', revisor_id: req.usuario._id, respuesta: 'Otra persona acreditó ser la propietaria', fecha_revision: ahora },
      );
    }

    await Notificacion.create({
      usuario_id: reclamacion.usuario_id,
      tipo: 'reclamacion_negocio',
      mensaje:
        estado === 'aceptada'
          ? `Ya gestionas la ficha de "${post?.titulo}"`
          : `No se ha aceptado tu reclamación de "${post?.titulo}"${respuesta ? `: ${respuesta}` : ''}`,
      referencia_id: reclamacion.post_id,
      referencia_tipo: 'post',
    });

    res.json({ ok: true, reclamacion });
  } catch (error) {
    next(error);
  }
};
