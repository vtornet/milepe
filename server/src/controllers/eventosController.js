import Post from '../models/Post.js';
import EventoDetalle, { CATEGORIAS_EVENTO } from '../models/EventoDetalle.js';
import AsistenciaEvento from '../models/AsistenciaEvento.js';
import { eventoAIcs } from '../utils/calendarioIcs.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { aPuntoGeoJSON, deGeoJSONaLatLng } from '../utils/geo.js';
import { CAMPOS_PUBLICOS_USUARIO } from '../models/constantes.js';

const formatearEvento = (post, detalle) => ({
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
  fecha_inicio: detalle.fecha_inicio,
  fecha_fin: detalle.fecha_fin,
  lugar: detalle.lugar,
  ubicacion: deGeoJSONaLatLng(detalle.ubicacion),
  patrocinado: typeof detalle.estaPatrocinado === 'function' ? detalle.estaPatrocinado() : false,
  patrocinador_nombre: detalle.patrocinador_nombre,
  asistentes: detalle.asistentes || 0,
});

// Crea el Post (tipo 'evento') y su EventoDetalle. Misma compensacion sin
// transacciones que Quejas/Fotos: si el detalle falla, se borra el post
// que se acababa de crear.
export const crearEvento = async (req, res, next) => {
  let post;

  try {
    const { titulo, contenido, imagenes, categoria, fecha_inicio, fecha_fin, lugar, ubicacion } = req.body;

    post = await Post.create({
      autor_id: req.usuario._id,
      tipo: 'evento',
      titulo,
      contenido,
      imagenes,
    });

    // A diferencia de Quejas, la ubicacion es opcional aqui (un evento se
    // puede publicar sin pin todavia): solo se convierte a GeoJSON si vino.
    const detalle = await EventoDetalle.create({
      post_id: post._id,
      categoria,
      fecha_inicio,
      fecha_fin: fecha_fin || undefined,
      lugar,
      ubicacion: ubicacion ? aPuntoGeoJSON(ubicacion) : undefined,
    });

    await post.populate('autor_id', CAMPOS_PUBLICOS_USUARIO);

    res.status(201).json({ ok: true, evento: formatearEvento(post, detalle) });
  } catch (error) {
    if (post) await Post.deleteOne({ _id: post._id });
    next(error);
  }
};

// Listado publico: agenda ordenada por fecha_inicio (el mas proximo
// primero, no el mas recientemente publicado como en Quejas/Fotos). Por
// defecto oculta lo ya terminado; ?incluirPasados=true lo trae de vuelta
// para quien quiera ver el historial de ferias/fiestas pasadas.
export const listarEventos = async (req, res, next) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 20));
    const incluirPasados = req.query.incluirPasados === 'true';

    if (req.query.categoria && !CATEGORIAS_EVENTO.includes(req.query.categoria)) {
      throw new ErrorHttp(400, `categoria debe ser una de: ${CATEGORIAS_EVENTO.join(', ')}`);
    }

    const filtroDetalle = {};
    if (req.query.categoria) filtroDetalle['detalle.categoria'] = req.query.categoria;

    const ahora = new Date();
    if (!incluirPasados) {
      // "Ya termino" es fecha_fin si la tiene, o fecha_inicio si no (un
      // evento de un solo dia no lleva fecha_fin).
      filtroDetalle.$or = [
        { 'detalle.fecha_fin': { $gte: ahora } },
        { 'detalle.fecha_fin': null, 'detalle.fecha_inicio': { $gte: ahora } },
      ];
    }

    const pipeline = [
      { $match: { tipo: 'evento', estado_moderacion: 'publicado' } },
      { $lookup: { from: 'eventodetalles', localField: '_id', foreignField: 'post_id', as: 'detalle' } },
      { $unwind: '$detalle' },
      ...(Object.keys(filtroDetalle).length ? [{ $match: filtroDetalle }] : []),
      // En la agenda de proximos, los patrocinados van primero (es lo que se
      // paga); dentro de cada grupo, por fecha. Con el historial no: ahi
      // manda la fecha.
      ...(incluirPasados
        ? [{ $sort: { 'detalle.fecha_inicio': -1 } }]
        : [
            { $addFields: { _patrocinado: { $gt: ['$detalle.patrocinado_hasta', '$$NOW'] } } },
            { $sort: { _patrocinado: -1, 'detalle.fecha_inicio': 1 } },
          ]),
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
                editado: '$editado',
                editado_en: '$editado_en',
                revision_pendiente: '$revision_pendiente',
                categoria: '$detalle.categoria',
                fecha_inicio: '$detalle.fecha_inicio',
                fecha_fin: '$detalle.fecha_fin',
                lugar: '$detalle.lugar',
                asistentes: { $ifNull: ['$detalle.asistentes', 0] },
                ubicacion: '$detalle.ubicacion',
                patrocinador_nombre: '$detalle.patrocinador_nombre',
                patrocinado_hasta: '$detalle.patrocinado_hasta',
                autor: { _id: '$autor._id', nombre_usuario: '$autor.nombre_usuario', avatar_url: '$autor.avatar_url', oficial: '$autor.oficial', verificado_manual: '$autor.verificado_manual', verificado_hasta: '$autor.verificado_hasta' },
              },
            },
          ],
          total: [{ $count: 'valor' }],
        },
      },
    ];

    const [resultado] = await Post.aggregate(pipeline);
    const total = resultado.total[0]?.valor || 0;
    const ahoraMs = Date.now();
    const items = resultado.items.map((item) => ({
      ...item,
      ubicacion: deGeoJSONaLatLng(item.ubicacion),
      patrocinado: Boolean(item.patrocinado_hasta && new Date(item.patrocinado_hasta).getTime() > ahoraMs),
      patrocinado_hasta: undefined,
    }));

    res.json({
      ok: true,
      eventos: items,
      paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerEvento = async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, tipo: 'evento' }).populate(
      'autor_id',
      CAMPOS_PUBLICOS_USUARIO,
    );

    if (!post || post.estado_moderacion === 'eliminado') {
      throw new ErrorHttp(404, 'Evento no encontrado');
    }

    const detalle = await EventoDetalle.findOne({ post_id: post._id });
    if (!detalle) {
      throw new ErrorHttp(404, 'Evento no encontrado');
    }

    res.json({ ok: true, evento: formatearEvento(post, detalle) });
  } catch (error) {
    next(error);
  }
};

// --- Voy a ir y calendario ---

export const cargarEvento = async (id) => {
  const post = await Post.findOne({ _id: id, tipo: 'evento', estado_moderacion: 'publicado' });
  const detalle = post && (await EventoDetalle.findOne({ post_id: post._id }));
  if (!detalle) throw new ErrorHttp(404, 'Evento no encontrado');
  return { post, detalle };
};

// Alterna "voy a ir". El indice unico de AsistenciaEvento es quien decide si
// ya estaba apuntado: si dos peticiones llegan a la vez, una falla con
// duplicado y no se cuenta dos veces.
export const alternarAsistencia = async (req, res, next) => {
  try {
    const { post } = await cargarEvento(req.params.id);
    const filtro = { post_id: post._id, usuario_id: req.usuario._id };

    const quitada = await AsistenciaEvento.findOneAndDelete(filtro);
    let voy = false;
    if (quitada) {
      await EventoDetalle.updateOne({ post_id: post._id, asistentes: { $gt: 0 } }, { $inc: { asistentes: -1 } });
    } else {
      try {
        await AsistenciaEvento.create(filtro);
        await EventoDetalle.updateOne({ post_id: post._id }, { $inc: { asistentes: 1 } });
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
      voy = true;
    }

    const { asistentes } = await EventoDetalle.findOne({ post_id: post._id }).select('asistentes');
    res.json({ ok: true, voy, asistentes });
  } catch (error) {
    next(error);
  }
};

// Los eventos a los que voy, para marcar el boton en la agenda sin añadir un
// campo por usuario a cada listado (mismo criterio que mis-reacciones).
export const misAsistencias = async (req, res, next) => {
  try {
    const filas = await AsistenciaEvento.find({ usuario_id: req.usuario._id })
      .sort({ fecha_creacion: -1 })
      .limit(500)
      .select('post_id');
    res.json({ ok: true, eventos: filas.map((f) => String(f.post_id)) });
  } catch (error) {
    next(error);
  }
};

export const calendarioEvento = async (req, res, next) => {
  try {
    const { post, detalle } = await cargarEvento(req.params.id);
    const base = (process.env.CLIENT_URL || 'https://milepe.com').split(',')[0].trim();

    const ics = eventoAIcs({
      id: post._id,
      titulo: post.titulo,
      descripcion: post.contenido,
      lugar: detalle.lugar,
      inicio: detalle.fecha_inicio,
      fin: detalle.fecha_fin,
      url: `${base}/eventos`,
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="evento-${post._id}.ics"`);
    res.send(ics);
  } catch (error) {
    next(error);
  }
};
