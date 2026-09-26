import Post from '../models/Post.js';
import EmpleoDetalle, { MODALIDADES_EMPLEO, SECTORES_EMPLEO } from '../models/EmpleoDetalle.js';
import ErrorHttp from '../utils/ErrorHttp.js';

const formatearEmpleo = (post, detalle) => ({
  _id: post._id,
  titulo: post.titulo,
  contenido: post.contenido,
  imagenes: post.imagenes,
  reacciones: post.reacciones_resumen,
  num_comentarios: post.num_comentarios,
  fecha_creacion: post.fecha_creacion,
  autor: post.autor_id,
  modalidad: detalle.modalidad,
  sector: detalle.sector,
  zona: detalle.zona,
  disponible_desde: detalle.disponible_desde,
  puesto: detalle.puesto,
  jornal: detalle.jornal,
  fecha_caducidad: detalle.fecha_caducidad,
  estado_oferta: detalle.estado_oferta,
});

// Crea el Post (tipo 'empleo_busco' o 'empleo_ofrezco' segun la modalidad)
// y su EmpleoDetalle. Mismo patron de compensacion sin transacciones que
// el resto de secciones. fecha_caducidad nunca se acepta del cliente: la
// calcula sola EmpleoDetalle (+30 dias) al crear la oferta.
export const crearEmpleo = async (req, res, next) => {
  let post;

  try {
    const { titulo, contenido, imagenes, modalidad, sector, zona, puesto, jornal } = req.body;

    if (!MODALIDADES_EMPLEO.includes(modalidad)) {
      throw new ErrorHttp(400, `modalidad debe ser una de: ${MODALIDADES_EMPLEO.join(', ')}`);
    }

    post = await Post.create({
      autor_id: req.usuario._id,
      tipo: modalidad === 'busco' ? 'empleo_busco' : 'empleo_ofrezco',
      titulo,
      contenido,
      imagenes,
    });

    const detalle = await EmpleoDetalle.create({ post_id: post._id, modalidad, sector, zona, puesto, jornal });

    await post.populate('autor_id', 'nombre_usuario nombre avatar_url');

    res.status(201).json({ ok: true, empleo: formatearEmpleo(post, detalle) });
  } catch (error) {
    if (post) await Post.deleteOne({ _id: post._id });
    next(error);
  }
};

// Listado publico. modalidad es obligatoria (no como categoria/epoca en
// otras secciones): 'busco' y 'ofrezco' tienen forma tan distinta
// (candidato vs oferta) que mezclarlas en un mismo listado no tendria
// sentido para el cliente - son dos pestañas, no un filtro opcional.
// Para 'ofrezco', por defecto solo se ven las activas; ?incluirCaducadas
// =true trae tambien las que ya vencieron (para que el propio autor pueda
// verlas y republicarlas).
export const listarEmpleo = async (req, res, next) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 20));

    if (!MODALIDADES_EMPLEO.includes(req.query.modalidad)) {
      throw new ErrorHttp(400, `modalidad es obligatoria y debe ser una de: ${MODALIDADES_EMPLEO.join(', ')}`);
    }
    if (req.query.sector && !SECTORES_EMPLEO.includes(req.query.sector)) {
      throw new ErrorHttp(400, `sector debe ser uno de: ${SECTORES_EMPLEO.join(', ')}`);
    }

    const filtroDetalle = { 'detalle.modalidad': req.query.modalidad };
    if (req.query.sector) filtroDetalle['detalle.sector'] = req.query.sector;
    if (req.query.modalidad === 'ofrezco' && req.query.incluirCaducadas !== 'true') {
      filtroDetalle['detalle.estado_oferta'] = 'activa';
    }

    const pipeline = [
      { $match: { tipo: { $in: ['empleo_busco', 'empleo_ofrezco'] }, estado_moderacion: 'publicado' } },
      { $sort: { fecha_creacion: -1 } },
      { $lookup: { from: 'empleodetalles', localField: '_id', foreignField: 'post_id', as: 'detalle' } },
      { $unwind: '$detalle' },
      { $match: filtroDetalle },
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
                modalidad: '$detalle.modalidad',
                sector: '$detalle.sector',
                zona: '$detalle.zona',
                disponible_desde: '$detalle.disponible_desde',
                puesto: '$detalle.puesto',
                jornal: '$detalle.jornal',
                fecha_caducidad: '$detalle.fecha_caducidad',
                estado_oferta: '$detalle.estado_oferta',
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
      empleo: resultado.items,
      paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerEmpleo = async (req, res, next) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      tipo: { $in: ['empleo_busco', 'empleo_ofrezco'] },
    }).populate('autor_id', 'nombre_usuario nombre avatar_url');

    if (!post || post.estado_moderacion === 'eliminado') {
      throw new ErrorHttp(404, 'Oferta no encontrada');
    }

    const detalle = await EmpleoDetalle.findOne({ post_id: post._id });
    if (!detalle) {
      throw new ErrorHttp(404, 'Oferta no encontrada');
    }

    res.json({ ok: true, empleo: formatearEmpleo(post, detalle) });
  } catch (error) {
    next(error);
  }
};

// Solo el autor de la oferta puede republicarla, y solo tiene sentido para
// 'ofrezco' (EmpleoDetalle.republicar() ya lanza si no lo es).
export const republicarEmpleo = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.estado_moderacion === 'eliminado') {
      throw new ErrorHttp(404, 'Oferta no encontrada');
    }
    if (!post.autor_id.equals(req.usuario._id)) {
      throw new ErrorHttp(403, 'Solo el autor de la oferta puede republicarla');
    }

    const detalle = await EmpleoDetalle.findOne({ post_id: post._id });
    if (!detalle) {
      throw new ErrorHttp(404, 'Oferta no encontrada');
    }

    const dias = req.body.dias ? parseInt(req.body.dias, 10) : undefined;

    try {
      detalle.republicar(dias);
    } catch (errorModelo) {
      throw new ErrorHttp(400, errorModelo.message);
    }

    await detalle.save();

    res.json({ ok: true, estado_oferta: detalle.estado_oferta, fecha_caducidad: detalle.fecha_caducidad });
  } catch (error) {
    next(error);
  }
};
