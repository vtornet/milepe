import mongoose from 'mongoose';
import Post from '../models/Post.js';
import QuejaDetalle, { CATEGORIAS_QUEJA, ESTADOS_QUEJA } from '../models/QuejaDetalle.js';
import Notificacion from '../models/Notificacion.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { aPuntoGeoJSON, deGeoJSONaLatLng } from '../utils/geo.js';
import { CAMPOS_PUBLICOS_USUARIO } from '../models/constantes.js';

// Post y QuejaDetalle se muestran siempre juntos de cara al cliente: esta
// funcion los combina en una sola forma consistente, la use el create, el
// listado (via agregacion) o el detalle (via populate).
// El historial que ve cualquiera: estado, nota, fecha y si fue la cuenta
// oficial. Nunca quien exactamente (moderador_id), igual que en moderacion.
const historialPublico = (historial = []) =>
  historial.map(({ estado, nota, fecha, oficial }) => ({ estado, nota: nota || null, fecha, oficial: Boolean(oficial) }));

const formatearQueja = (post, detalle) => ({
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
  ubicacion: deGeoJSONaLatLng(detalle.ubicacion),
  direccion_aproximada: detalle.direccion_aproximada,
  estado: detalle.estado,
  historial_estados: historialPublico(detalle.historial_estados),
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

    await post.populate('autor_id', CAMPOS_PUBLICOS_USUARIO);

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
                reacciones: '$reacciones_resumen',
                editado: '$editado',
                editado_en: '$editado_en',
                revision_pendiente: '$revision_pendiente',
                categoria: '$detalle.categoria',
                ubicacion: '$detalle.ubicacion',
                direccion_aproximada: '$detalle.direccion_aproximada',
                estado: '$detalle.estado',
                fecha_resolucion: '$detalle.fecha_resolucion',
                historial_estados: {
                  $map: {
                    input: '$detalle.historial_estados',
                    as: 'h',
                    in: { estado: '$$h.estado', nota: '$$h.nota', fecha: '$$h.fecha', oficial: '$$h.oficial' },
                  },
                },
                autor: { _id: '$autor._id', nombre_usuario: '$autor.nombre_usuario', avatar_url: '$autor.avatar_url', oficial: '$autor.oficial' },
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
      CAMPOS_PUBLICOS_USUARIO,
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

// Quien tramita las quejas: el equipo (moderador/admin) y la cuenta
// oficial del Ayuntamiento, que es a quien van dirigidas.
export const exigeGestorQuejas = (req, res, next) => {
  const { rol, oficial } = req.usuario || {};
  if (oficial || rol === 'moderador' || rol === 'admin') return next();
  return next(new ErrorHttp(403, 'Solo el Ayuntamiento o el equipo de MiLepe pueden tramitar quejas'));
};

const ETIQUETA_ESTADO = { pendiente: 'pendiente', en_curso: 'en curso', resuelto: 'resuelta' };

// Cambia el estado de tramitacion (pendiente/en_curso/resuelto) y/o deja una
// respuesta publica. No toca la visibilidad en el feed (eso es moderacion),
// son ejes independientes. Se puede responder sin cambiar el estado.
export const cambiarEstadoQueja = async (req, res, next) => {
  try {
    const { estado } = req.body;
    const nota = typeof req.body.nota === 'string' ? req.body.nota.trim() : '';

    const detalle = await QuejaDetalle.findOne({ post_id: req.params.id });
    if (!detalle) {
      throw new ErrorHttp(404, 'Queja no encontrada');
    }
    if (estado === detalle.estado && !nota) {
      throw new ErrorHttp(400, 'La queja ya está en ese estado: añade una respuesta o elige otro');
    }

    const cambia = estado !== detalle.estado;
    detalle.cambiarEstado(estado, req.usuario._id, { nota, oficial: Boolean(req.usuario.oficial) });
    await detalle.save();

    const post = await Post.findById(req.params.id).select('autor_id titulo');
    if (post && !post.autor_id.equals(req.usuario._id)) {
      const quien = req.usuario.oficial ? 'El Ayuntamiento' : 'El equipo de MiLepe';
      const que = cambia
        ? `ha pasado tu queja "${post.titulo}" a ${ETIQUETA_ESTADO[detalle.estado]}`
        : `ha respondido a tu queja "${post.titulo}"`;
      await Notificacion.create({
        usuario_id: post.autor_id,
        tipo: 'cambio_estado_queja',
        mensaje: `${quien} ${que}${nota ? `: ${nota.slice(0, 140)}` : ''}`,
        referencia_id: post._id,
        referencia_tipo: 'post',
      });
    }

    res.json({
      ok: true,
      estado: detalle.estado,
      fecha_resolucion: detalle.fecha_resolucion,
      historial_estados: historialPublico(detalle.historial_estados),
    });
  } catch (error) {
    if (error instanceof mongoose.Error) return next(error);
    if (error.message?.startsWith('Estado de queja no valido')) {
      return next(new ErrorHttp(400, error.message));
    }
    next(error);
  }
};

const DIA_MS = 24 * 60 * 60 * 1000;

// Resumen publico de como se atienden las quejas: cuantas hay por estado,
// que parte se ha resuelto y cuanto se tarda en responder y en resolver. Es
// transparencia: cualquiera puede ver si las quejas sirven para algo.
export const resumenQuejas = async (req, res, next) => {
  try {
    const filas = await Post.aggregate([
      { $match: { tipo: 'queja', estado_moderacion: 'publicado' } },
      { $lookup: { from: 'quejadetalles', localField: '_id', foreignField: 'post_id', as: 'detalle' } },
      { $unwind: '$detalle' },
      {
        $project: {
          creada: '$fecha_creacion',
          estado: '$detalle.estado',
          resuelta: '$detalle.fecha_resolucion',
          primera: { $min: '$detalle.historial_estados.fecha' },
        },
      },
    ]);

    const porEstado = { pendiente: 0, en_curso: 0, resuelto: 0 };
    for (const f of filas) porEstado[f.estado] = (porEstado[f.estado] || 0) + 1;

    // Media en dias, con un decimal; null si todavia no hay ninguna.
    const media = (valores) =>
      valores.length ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length / DIA_MS) * 10) / 10 : null;

    res.json({
      ok: true,
      total: filas.length,
      por_estado: porEstado,
      porcentaje_resueltas: filas.length ? Math.round((porEstado.resuelto / filas.length) * 100) : null,
      dias_hasta_respuesta: media(filas.filter((f) => f.primera).map((f) => f.primera - f.creada)),
      dias_hasta_resolucion: media(filas.filter((f) => f.resuelta).map((f) => f.resuelta - f.creada)),
    });
  } catch (error) {
    next(error);
  }
};

