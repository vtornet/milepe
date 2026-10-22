import Usuario from '../models/Usuario.js';
import Post from '../models/Post.js';
import Comentario from '../models/Comentario.js';
import Reaccion from '../models/Reaccion.js';
import Seguimiento from '../models/Seguimiento.js';
import Bloqueo from '../models/Bloqueo.js';
import Suscripcion from '../models/Suscripcion.js';
import Mensaje from '../models/Mensaje.js';
import Conversacion from '../models/Conversacion.js';
import Reporte from '../models/Reporte.js';
import Apelacion from '../models/Apelacion.js';
import RegistroModeracion from '../models/RegistroModeracion.js';
import QuejaDetalle from '../models/QuejaDetalle.js';
import EventoDetalle from '../models/EventoDetalle.js';
import NegocioDetalle from '../models/NegocioDetalle.js';
import EmpleoDetalle from '../models/EmpleoDetalle.js';
import RecursoTuristico from '../models/RecursoTuristico.js';
import ContactoInteres from '../models/ContactoInteres.js';

const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_SERIE = 30;
const ZONA = 'Europe/Madrid';

// Convierte el resultado de un $group por clave en { clave: n }.
const aMapa = (filas) => Object.fromEntries(filas.map((f) => [f._id ?? 'sin_valor', f.n]));
const agrupar = (Modelo, campo, filtro = {}) =>
  Modelo.aggregate([{ $match: filtro }, { $group: { _id: `$${campo}`, n: { $sum: 1 } } }]).then(aMapa);

// Altas por dia de los ultimos DIAS_SERIE dias, con los dias vacios a 0
// (un $group solo devuelve los dias en que paso algo, y una grafica con
// huecos engaña).
const serieDiaria = async (Modelo, filtro, desde) => {
  const filas = await Modelo.aggregate([
    { $match: { ...filtro, fecha_creacion: { $gte: desde } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha_creacion', timezone: ZONA } }, n: { $sum: 1 } } },
  ]);
  const porDia = aMapa(filas);

  const serie = [];
  for (let i = DIAS_SERIE - 1; i >= 0; i -= 1) {
    const dia = new Date(Date.now() - i * DIA_MS).toLocaleDateString('sv-SE', { timeZone: ZONA });
    serie.push({ dia, n: porDia[dia] || 0 });
  }
  return serie;
};

// Cuantos ids distintos aparecen en varias listas: "vecinos activos" son
// los que publicaron, comentaron o reaccionaron, no los que solo entraron.
const unicos = (...listas) => new Set(listas.flat().map(String)).size;

// GET /api/estadisticas — solo admin. Todo son recuentos y agregados:
// de la mensajeria privada se cuenta el volumen, nunca el contenido.
export const obtenerEstadisticas = async (req, res, next) => {
  try {
    const ahora = new Date();
    const hace7 = new Date(ahora - 7 * DIA_MS);
    const hace30 = new Date(ahora - 30 * DIA_MS);
    const publicado = { estado_moderacion: 'publicado' };

    const [
      usuariosTotal,
      usuariosActivos,
      usuariosPorRol,
      usuariosVerificados,
      usuariosPerfilCompleto,
      usuariosGoogle,
      usuariosNuevos7,
      usuariosNuevos30,
      serieUsuarios,

      postsPorEstado,
      postsPublicadosPorTipo,
      postsNuevos7,
      postsNuevos30,
      postsEditados,
      edicionesPendientes,
      seriePosts,
      topAutores,
      topPosts,

      comentariosVisibles,
      comentariosRetirados,
      comentariosNuevos7,
      comentariosNuevos30,
      serieComentarios,

      reaccionesTotal,
      reaccionesPorTipo,
      reaccionesNuevas7,

      autoresPosts30,
      autoresComentarios30,
      autoresReacciones30,
      autoresPosts7,
      autoresComentarios7,
      autoresReacciones7,

      seguimientosTotal,
      seguimientosMutuos,
      bloqueosTotal,
      conversacionesTotal,
      mensajesTotal,
      mensajesNuevos7,
      suscripcionesPush,

      reportesPorEstado,
      reportesPorMotivo,
      apelacionesPorEstado,
      accionesModeracion30,

      quejasPorEstado,
      quejasPorCategoria,
      quejasTiempo,
      eventosTotal,
      eventosProximos,
      negociosTotal,
      negociosDestacados,
      empleoPorModalidad,
      empleoOfertasPorEstado,
      turismoActivosPorSeccion,
      turismoOcultos,
      contactosActivos,
      contactosInactivos,
    ] = await Promise.all([
      Usuario.countDocuments(),
      Usuario.countDocuments({ activo: true }),
      agrupar(Usuario, 'rol'),
      Usuario.countDocuments({ email_verificado: true }),
      Usuario.countDocuments({ perfil_completo: true }),
      Usuario.countDocuments({ google_id: { $ne: null } }),
      Usuario.countDocuments({ fecha_creacion: { $gte: hace7 } }),
      Usuario.countDocuments({ fecha_creacion: { $gte: hace30 } }),
      serieDiaria(Usuario, {}, hace30),

      agrupar(Post, 'estado_moderacion'),
      agrupar(Post, 'tipo', publicado),
      Post.countDocuments({ ...publicado, fecha_creacion: { $gte: hace7 } }),
      Post.countDocuments({ ...publicado, fecha_creacion: { $gte: hace30 } }),
      Post.countDocuments({ ...publicado, editado_en: { $ne: null } }),
      Post.countDocuments({ revision_pendiente: true }),
      serieDiaria(Post, publicado, hace30),
      Post.aggregate([
        { $match: { ...publicado, fecha_creacion: { $gte: hace30 } } },
        { $group: { _id: '$autor_id', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'usuarios', localField: '_id', foreignField: '_id', as: 'u' } },
        { $project: { _id: 0, nombre_usuario: { $arrayElemAt: ['$u.nombre_usuario', 0] }, n: 1 } },
      ]),
      Post.aggregate([
        { $match: { ...publicado, fecha_creacion: { $gte: hace30 } } },
        {
          $addFields: {
            reacciones: {
              $sum: { $map: { input: { $objectToArray: { $ifNull: ['$reacciones_resumen', {}] } }, as: 'r', in: '$$r.v' } },
            },
          },
        },
        { $addFields: { interaccion: { $add: ['$reacciones', { $ifNull: ['$num_comentarios', 0] }] } } },
        { $sort: { interaccion: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'usuarios', localField: 'autor_id', foreignField: '_id', as: 'u' } },
        {
          $project: {
            _id: 1,
            titulo: 1,
            tipo: 1,
            reacciones: 1,
            comentarios: { $ifNull: ['$num_comentarios', 0] },
            nombre_usuario: { $arrayElemAt: ['$u.nombre_usuario', 0] },
          },
        },
      ]),

      Comentario.countDocuments(publicado),
      Comentario.countDocuments({ estado_moderacion: { $ne: 'publicado' } }),
      Comentario.countDocuments({ ...publicado, fecha_creacion: { $gte: hace7 } }),
      Comentario.countDocuments({ ...publicado, fecha_creacion: { $gte: hace30 } }),
      serieDiaria(Comentario, publicado, hace30),

      Reaccion.countDocuments(),
      agrupar(Reaccion, 'tipo'),
      Reaccion.countDocuments({ fecha_creacion: { $gte: hace7 } }),

      Post.distinct('autor_id', { fecha_creacion: { $gte: hace30 } }),
      Comentario.distinct('autor_id', { fecha_creacion: { $gte: hace30 } }),
      Reaccion.distinct('autor_id', { fecha_creacion: { $gte: hace30 } }),
      Post.distinct('autor_id', { fecha_creacion: { $gte: hace7 } }),
      Comentario.distinct('autor_id', { fecha_creacion: { $gte: hace7 } }),
      Reaccion.distinct('autor_id', { fecha_creacion: { $gte: hace7 } }),

      Seguimiento.countDocuments(),
      // Dos filas por pareja = se siguen los dos: el canal de mensajes abierto.
      Seguimiento.aggregate([
        {
          $project: {
            par: {
              $cond: [
                { $lt: ['$seguidor_id', '$seguido_id'] },
                ['$seguidor_id', '$seguido_id'],
                ['$seguido_id', '$seguidor_id'],
              ],
            },
          },
        },
        { $group: { _id: '$par', n: { $sum: 1 } } },
        { $match: { n: 2 } },
        { $count: 'valor' },
      ]).then((r) => r[0]?.valor || 0),
      Bloqueo.countDocuments(),
      Conversacion.countDocuments(),
      Mensaje.countDocuments(),
      Mensaje.countDocuments({ fecha_creacion: { $gte: hace7 } }),
      Suscripcion.distinct('usuario_id').then((ids) => ids.length),

      agrupar(Reporte, 'estado'),
      agrupar(Reporte, 'motivo'),
      agrupar(Apelacion, 'estado'),
      agrupar(RegistroModeracion, 'accion', { fecha_creacion: { $gte: hace30 } }),

      agrupar(QuejaDetalle, 'estado'),
      agrupar(QuejaDetalle, 'categoria'),
      QuejaDetalle.aggregate([
        { $match: { estado: 'resuelto', fecha_resolucion: { $ne: null } } },
        { $group: { _id: null, medio_ms: { $avg: { $subtract: ['$fecha_resolucion', '$fecha_creacion'] } }, n: { $sum: 1 } } },
      ]).then((r) => (r[0] ? { dias: Math.round((r[0].medio_ms / DIA_MS) * 10) / 10, n: r[0].n } : null)),
      EventoDetalle.countDocuments(),
      EventoDetalle.countDocuments({ fecha_inicio: { $gte: ahora } }),
      NegocioDetalle.countDocuments(),
      NegocioDetalle.countDocuments({ destacado_hasta: { $gt: ahora } }),
      agrupar(EmpleoDetalle, 'modalidad'),
      agrupar(EmpleoDetalle, 'estado_oferta', { modalidad: 'ofrezco' }),
      agrupar(RecursoTuristico, 'seccion', { activo: true }),
      RecursoTuristico.countDocuments({ activo: false }),
      ContactoInteres.countDocuments({ activo: true }),
      ContactoInteres.countDocuments({ activo: false }),
    ]);

    res.json({
      ok: true,
      generado_en: ahora,
      usuarios: {
        total: usuariosTotal,
        activos: usuariosActivos,
        desactivados: usuariosTotal - usuariosActivos,
        por_rol: usuariosPorRol,
        email_verificado: usuariosVerificados,
        perfil_completo: usuariosPerfilCompleto,
        con_google: usuariosGoogle,
        nuevos_7_dias: usuariosNuevos7,
        nuevos_30_dias: usuariosNuevos30,
        serie_altas: serieUsuarios,
        // Vecinos que hicieron algo (publicar, comentar o reaccionar).
        participantes_7_dias: unicos(autoresPosts7, autoresComentarios7, autoresReacciones7),
        participantes_30_dias: unicos(autoresPosts30, autoresComentarios30, autoresReacciones30),
      },
      contenido: {
        posts_por_estado: postsPorEstado,
        posts_publicados_por_tipo: postsPublicadosPorTipo,
        posts_nuevos_7_dias: postsNuevos7,
        posts_nuevos_30_dias: postsNuevos30,
        posts_editados: postsEditados,
        ediciones_pendientes: edicionesPendientes,
        serie_posts: seriePosts,
        comentarios: {
          visibles: comentariosVisibles,
          retirados: comentariosRetirados,
          nuevos_7_dias: comentariosNuevos7,
          nuevos_30_dias: comentariosNuevos30,
          serie: serieComentarios,
        },
        reacciones: { total: reaccionesTotal, por_tipo: reaccionesPorTipo, nuevas_7_dias: reaccionesNuevas7 },
        top_autores_30_dias: topAutores,
        top_posts_30_dias: topPosts,
      },
      social: {
        seguimientos: seguimientosTotal,
        seguimientos_mutuos: seguimientosMutuos,
        bloqueos: bloqueosTotal,
        conversaciones: conversacionesTotal,
        mensajes: mensajesTotal,
        mensajes_7_dias: mensajesNuevos7,
        usuarios_con_push: suscripcionesPush,
      },
      moderacion: {
        reportes_por_estado: reportesPorEstado,
        reportes_por_motivo: reportesPorMotivo,
        apelaciones_por_estado: apelacionesPorEstado,
        acciones_30_dias: accionesModeracion30,
      },
      secciones: {
        quejas: { por_estado: quejasPorEstado, por_categoria: quejasPorCategoria, resolucion_media: quejasTiempo },
        eventos: { total: eventosTotal, proximos: eventosProximos },
        negocios: { total: negociosTotal, destacados: negociosDestacados },
        empleo: { por_modalidad: empleoPorModalidad, ofertas_por_estado: empleoOfertasPorEstado },
        turismo: { recursos_activos_por_seccion: turismoActivosPorSeccion, ocultos: turismoOcultos },
        contactos: { activos: contactosActivos, inactivos: contactosInactivos },
      },
    });
  } catch (error) {
    next(error);
  }
};
