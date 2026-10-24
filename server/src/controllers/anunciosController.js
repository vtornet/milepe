import Post from '../models/Post.js';
import AnuncioDetalle, { CATEGORIAS_ANUNCIO, ZONAS_ANUNCIO } from '../models/AnuncioDetalle.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { CAMPOS_PUBLICOS_USUARIO } from '../models/constantes.js';

const formatearAnuncio = (post, detalle) => ({
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
  precio: detalle.precio,
  zona: detalle.zona,
  cerrado: detalle.cerrado,
  fecha_caducidad: detalle.fecha_caducidad,
  vigente: detalle.estaVigente(),
});

// Mismo patron de compensacion sin transacciones que el resto de secciones.
export const crearAnuncio = async (req, res, next) => {
  let post;

  try {
    const { titulo, contenido, imagenes, categoria, precio, zona } = req.body;

    post = await Post.create({ autor_id: req.usuario._id, tipo: 'anuncio', titulo, contenido, imagenes });
    const detalle = await AnuncioDetalle.create({
      post_id: post._id,
      categoria,
      // '' o ausente = sin precio; el modelo decide si hacia falta.
      precio: precio === '' || precio === undefined || precio === null ? null : Number(precio),
      zona,
    });

    await post.populate('autor_id', CAMPOS_PUBLICOS_USUARIO);
    res.status(201).json({ ok: true, anuncio: formatearAnuncio(post, detalle) });
  } catch (error) {
    if (post) await Post.deleteOne({ _id: post._id });
    next(error);
  }
};

// Por defecto solo los vigentes (abiertos y sin caducar), los mas recientes
// primero. ?incluirCerrados=true trae tambien los cerrados y caducados, que
// es lo que el autor necesita para renovar uno.
export const listarAnuncios = async (req, res, next) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 20));
    const { categoria, zona } = req.query;

    if (categoria && !CATEGORIAS_ANUNCIO.includes(categoria)) {
      throw new ErrorHttp(400, `categoria debe ser una de: ${CATEGORIAS_ANUNCIO.join(', ')}`);
    }
    if (zona && !ZONAS_ANUNCIO.includes(zona)) {
      throw new ErrorHttp(400, `zona debe ser una de: ${ZONAS_ANUNCIO.join(', ')}`);
    }

    const filtroDetalle = {};
    if (categoria) filtroDetalle['detalle.categoria'] = categoria;
    if (zona) filtroDetalle['detalle.zona'] = zona;
    if (req.query.incluirCerrados !== 'true') {
      filtroDetalle['detalle.cerrado'] = false;
      filtroDetalle['detalle.fecha_caducidad'] = { $gt: new Date() };
    }

    const [resultado] = await Post.aggregate([
      { $match: { tipo: 'anuncio', estado_moderacion: 'publicado' } },
      { $sort: { fecha_creacion: -1 } },
      { $lookup: { from: 'anunciodetalles', localField: '_id', foreignField: 'post_id', as: 'detalle' } },
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
                editado: '$editado',
                editado_en: '$editado_en',
                revision_pendiente: '$revision_pendiente',
                categoria: '$detalle.categoria',
                precio: '$detalle.precio',
                zona: '$detalle.zona',
                cerrado: '$detalle.cerrado',
                fecha_caducidad: '$detalle.fecha_caducidad',
                vigente: {
                  $and: [{ $not: ['$detalle.cerrado'] }, { $gt: ['$detalle.fecha_caducidad', '$$NOW'] }],
                },
                autor: {
                  _id: '$autor._id',
                  nombre_usuario: '$autor.nombre_usuario',
                  avatar_url: '$autor.avatar_url',
                  oficial: '$autor.oficial',
                },
              },
            },
          ],
          total: [{ $count: 'valor' }],
        },
      },
    ]);

    const total = resultado.total[0]?.valor || 0;
    res.json({
      ok: true,
      anuncios: resultado.items,
      paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (error) {
    next(error);
  }
};

const cargarPropio = async (req) => {
  const post = await Post.findOne({ _id: req.params.id, tipo: 'anuncio' });
  if (!post || post.estado_moderacion === 'eliminado') throw new ErrorHttp(404, 'Anuncio no encontrado');
  const detalle = await AnuncioDetalle.findOne({ post_id: post._id });
  if (!detalle) throw new ErrorHttp(404, 'Anuncio no encontrado');
  return { post, detalle };
};

export const obtenerAnuncio = async (req, res, next) => {
  try {
    const { post, detalle } = await cargarPropio(req);
    if (post.estado_moderacion !== 'publicado') throw new ErrorHttp(404, 'Anuncio no encontrado');
    await post.populate('autor_id', CAMPOS_PUBLICOS_USUARIO);
    res.json({ ok: true, anuncio: formatearAnuncio(post, detalle) });
  } catch (error) {
    next(error);
  }
};

// Cerrar (vendido, encontrado, ya no hace falta) o reabrir, y renovar: solo
// el autor. Un moderador que quiera retirarlo tiene la moderacion de siempre.
const soloElAutor = (req, post) => {
  if (!post.autor_id.equals(req.usuario._id)) {
    throw new ErrorHttp(403, 'Solo el autor puede cambiar este anuncio');
  }
};

export const cerrarAnuncio = async (req, res, next) => {
  try {
    const { post, detalle } = await cargarPropio(req);
    soloElAutor(req, post);

    detalle.cerrado = req.body?.cerrado !== false;
    await detalle.save();

    res.json({ ok: true, cerrado: detalle.cerrado, vigente: detalle.estaVigente() });
  } catch (error) {
    next(error);
  }
};

export const renovarAnuncio = async (req, res, next) => {
  try {
    const { post, detalle } = await cargarPropio(req);
    soloElAutor(req, post);

    try {
      detalle.renovar();
    } catch (errorModelo) {
      throw new ErrorHttp(400, errorModelo.message);
    }
    await detalle.save();

    res.json({ ok: true, fecha_caducidad: detalle.fecha_caducidad, vigente: detalle.estaVigente() });
  } catch (error) {
    next(error);
  }
};
