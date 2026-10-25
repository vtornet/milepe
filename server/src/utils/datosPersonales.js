import crypto from 'node:crypto';
import Usuario from '../models/Usuario.js';
import Post from '../models/Post.js';
import Comentario from '../models/Comentario.js';
import Reaccion from '../models/Reaccion.js';
import Seguimiento from '../models/Seguimiento.js';
import Bloqueo from '../models/Bloqueo.js';
import Notificacion from '../models/Notificacion.js';
import Conversacion from '../models/Conversacion.js';
import Mensaje from '../models/Mensaje.js';
import Reporte from '../models/Reporte.js';
import Apelacion from '../models/Apelacion.js';
import Suscripcion from '../models/Suscripcion.js';
import QuejaDetalle from '../models/QuejaDetalle.js';
import FotoDetalle from '../models/FotoDetalle.js';
import EventoDetalle from '../models/EventoDetalle.js';
import EmpleoDetalle from '../models/EmpleoDetalle.js';
import NegocioDetalle from '../models/NegocioDetalle.js';
import AvisoDetalle from '../models/AvisoDetalle.js';
import AnuncioDetalle from '../models/AnuncioDetalle.js';
import AnimalDetalle from '../models/AnimalDetalle.js';
import ReclamacionNegocio from '../models/ReclamacionNegocio.js';
import CorreoBloqueado from '../models/CorreoBloqueado.js';
import Pago from '../models/Pago.js';
import MiembroGrupo from '../models/MiembroGrupo.js';
import Grupo from '../models/Grupo.js';
import PublicacionGrupoDetalle from '../models/PublicacionGrupoDetalle.js';
import AsistenciaEvento from '../models/AsistenciaEvento.js';
import VotoEncuesta from '../models/VotoEncuesta.js';
import EncuestaDetalle from '../models/EncuestaDetalle.js';
import cloudinary from '../config/cloudinary.js';
import { hayCredencialesCloudinary } from './copiaSeguridad.js';

// RGPD: derecho de acceso y portabilidad (exportarDatos) y de supresion
// (eliminarCuenta). Vive aqui y no en un controlador porque toca casi todas
// las colecciones, y lo que hay que mantener al dia cuando se añada una
// coleccion nueva con datos de un usuario es justo esta lista.

const DETALLE_POR_TIPO = {
  queja: QuejaDetalle,
  foto: FotoDetalle,
  evento: EventoDetalle,
  empleo_busco: EmpleoDetalle,
  empleo_ofrezco: EmpleoDetalle,
  negocio: NegocioDetalle,
  aviso: AvisoDetalle,
  anuncio: AnuncioDetalle,
  animal: AnimalDetalle,
  grupo: PublicacionGrupoDetalle,
};

const sinInternos = ({ __v, ...resto }) => resto;

// --- Exportar ---

export const exportarDatos = async (usuarioId) => {
  const usuario = await Usuario.findById(usuarioId).select('+nombre +apellidos').lean();

  const [posts, comentarios, reacciones, siguiendo, seguidores, bloqueos, notificaciones, reportes, apelaciones, suscripciones, reclamaciones, asistencias, votos, grupos, pagos] =
    await Promise.all([
      Post.find({ autor_id: usuarioId }).lean(),
      Comentario.find({ autor_id: usuarioId }).lean(),
      Reaccion.find({ autor_id: usuarioId }).lean(),
      Seguimiento.find({ seguidor_id: usuarioId }).populate('seguido_id', 'nombre_usuario').lean(),
      Seguimiento.find({ seguido_id: usuarioId }).populate('seguidor_id', 'nombre_usuario').lean(),
      Bloqueo.find({ bloqueador_id: usuarioId }).populate('bloqueado_id', 'nombre_usuario').lean(),
      Notificacion.find({ usuario_id: usuarioId }).lean(),
      Reporte.find({ reportante_id: usuarioId }).lean(),
      Apelacion.find({ autor_id: usuarioId }).lean(),
      Suscripcion.find({ usuario_id: usuarioId }).lean(),
      ReclamacionNegocio.find({ usuario_id: usuarioId }).lean(),
      AsistenciaEvento.find({ usuario_id: usuarioId }).lean(),
      VotoEncuesta.find({ usuario_id: usuarioId }).lean(),
      MiembroGrupo.find({ usuario_id: usuarioId }).populate('grupo_id', 'nombre creador_id').lean(),
      Pago.find({ usuario_id: usuarioId }).lean(),
    ]);

  // Cada publicacion con los datos de su seccion.
  const publicaciones = await Promise.all(
    posts.map(async (post) => {
      const Detalle = DETALLE_POR_TIPO[post.tipo];
      const detalle = Detalle ? await Detalle.findOne({ post_id: post._id }).lean() : null;
      return { ...sinInternos(post), detalle: detalle ? sinInternos(detalle) : null };
    }),
  );

  // Las conversaciones propias, con todos sus mensajes: los del otro tambien,
  // porque son la conversacion que esta persona tuvo.
  const conversaciones = await Conversacion.find({ participantes: usuarioId }).populate('participantes', 'nombre_usuario').lean();
  const hilos = await Promise.all(
    conversaciones.map(async (c) => {
      const otro = c.participantes.find((p) => String(p._id) !== String(usuarioId));
      const mensajes = await Mensaje.find({ conversacion_id: c._id }).sort({ fecha_creacion: 1 }).lean();
      return {
        con: otro?.nombre_usuario || null,
        mensajes: mensajes.map((m) => ({
          de: String(m.autor_id) === String(usuarioId) ? 'yo' : otro?.nombre_usuario || 'otro',
          texto: m.texto,
          fecha: m.fecha_creacion,
          leido_en: m.leido_en,
        })),
      };
    }),
  );

  const { contraseña, token_recuperacion, token_verificacion, ...perfil } = usuario;

  return {
    exportado_en: new Date().toISOString(),
    servicio: 'MiLepe (milepe.com)',
    perfil: sinInternos(perfil),
    publicaciones,
    comentarios: comentarios.map(sinInternos),
    reacciones: reacciones.map(sinInternos),
    siguiendo: siguiendo.map((s) => ({ usuario: s.seguido_id?.nombre_usuario || null, desde: s.fecha_creacion })),
    seguidores: seguidores.map((s) => ({ usuario: s.seguidor_id?.nombre_usuario || null, desde: s.fecha_creacion })),
    bloqueados: bloqueos.map((b) => ({ usuario: b.bloqueado_id?.nombre_usuario || null, desde: b.fecha_creacion })),
    conversaciones: hilos,
    notificaciones: notificaciones.map(sinInternos),
    reportes_hechos: reportes.map(sinInternos),
    apelaciones: apelaciones.map(sinInternos),
    reclamaciones_de_negocios: reclamaciones.map(sinInternos),
    votos_en_encuestas: votos.map((v) => ({ encuesta: v.post_id, opcion: v.opcion, fecha: v.fecha_creacion })),
    grupos: grupos.map((g) => ({
      grupo: g.grupo_id?.nombre || null,
      creado_por_mi: String(g.grupo_id?.creador_id) === String(usuarioId),
      desde: g.fecha_creacion,
    })),
    // Los pagos se conservan aunque se borre la cuenta (registro contable).
    pagos: pagos.map((p) => ({
      producto: p.producto,
      importe_eur: p.importe / 100,
      estado: p.estado,
      dias: p.dias,
      fecha: p.fecha_creacion,
      pagado_en: p.pagado_en,
    })),
    eventos_a_los_que_voy: asistencias.map((a) => ({ evento: a.post_id, desde: a.fecha_creacion })),
    // Solo el servicio, no la direccion entera: es un identificador del navegador.
    avisos_push: suscripciones.map((s) => ({ servicio: new URL(s.endpoint).host, desde: s.fecha_creacion })),
  };
};

// --- Eliminar ---

// "https://res.cloudinary.com/<nube>/image/upload/v123/milepe/abc.jpg" -> "milepe/abc"
export const idPublicoDeCloudinary = (url) => {
  const m = /res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(milepe\/[^.]+)\.[a-z0-9]+$/i.exec(url || '');
  return m ? m[1] : null;
};

// Borrar las fotos de Cloudinary es lo justo (son suyas), pero no puede
// tumbar la baja: si falla, la cuenta se borra igual y queda en el log.
const borrarImagenes = async (urls) => {
  const ids = [...new Set(urls.map(idPublicoDeCloudinary).filter(Boolean))];
  if (ids.length === 0 || !hayCredencialesCloudinary()) return 0;

  try {
    for (let i = 0; i < ids.length; i += 100) {
      await cloudinary.api.delete_resources(ids.slice(i, i + 100));
    }
    return ids.length;
  } catch (error) {
    console.error('[rgpd] No se pudieron borrar algunas imagenes de Cloudinary:', error.message);
    return 0;
  }
};

// Supresion de la cuenta. El documento Usuario NO se borra: publicaciones,
// conversaciones del otro y el registro de moderacion le apuntan por id. Se
// vacia de todo lo que identifica a la persona y se desactiva, y lo que
// publico se retira como si lo hubiera borrado el:
//
// - Publicaciones y comentarios: borrado blando con borrado_por_autor (los
//   comentarios quedan como hueco, sin texto ni autor, para no romper hilos).
// - Reacciones, seguimientos (en los dos sentidos), bloqueos, notificaciones
//   y suscripciones push: se borran.
// - Mensajes privados: se quedan para la otra persona (es su conversacion
//   tambien), firmados ya por una cuenta anonima.
// - Reportes, apelaciones y registro de moderacion: se conservan (interes
//   legitimo: son el expediente de lo que se hizo y por que), apuntando a la
//   cuenta anonima.
export const eliminarCuenta = async (usuarioId) => {
  const usuario = await Usuario.findById(usuarioId);
  if (!usuario) return null;

  // Borrar la cuenta no puede ser la forma de saltarse una suspension: su
  // correo queda vetado para registrarse mientras dure (ver CorreoBloqueado).
  if (usuario.estaSuspendido()) {
    await CorreoBloqueado.bloquear(usuario.email, usuario.suspension);
  }

  const posts = await Post.find({ autor_id: usuarioId, estado_moderacion: { $ne: 'eliminado' } });
  for (const post of posts) {
    post.estado_moderacion = 'eliminado';
    post.borrado_por_autor = true;
    post.revision_pendiente = false;
    await post.save();
  }

  // Uno a uno con save(): los hooks del modelo mantienen num_comentarios.
  const comentarios = await Comentario.find({ autor_id: usuarioId, estado_moderacion: { $ne: 'eliminado' } });
  for (const comentario of comentarios) {
    comentario.estado_moderacion = 'eliminado';
    comentario.borrado_por_autor = true;
    await comentario.save();
  }

  // Quitar cada reaccion por el mismo camino que al pulsarla otra vez, para
  // que los contadores de las publicaciones bajen.
  const reacciones = await Reaccion.find({ autor_id: usuarioId });
  for (const r of reacciones) {
    await Reaccion.alternar({ autor_id: usuarioId, tipo: r.tipo, post_id: r.post_id, comentario_id: r.comentario_id });
  }

  // Sus 'voy a ir', bajando el contador de cada evento.
  const asistencias = await AsistenciaEvento.find({ usuario_id: usuarioId });
  for (const a of asistencias) {
    await EventoDetalle.updateOne({ post_id: a.post_id, asistentes: { $gt: 0 } }, { $inc: { asistentes: -1 } });
  }
  await AsistenciaEvento.deleteMany({ usuario_id: usuarioId });

  // Sus votos, descontandolos del recuento de cada encuesta.
  const votos = await VotoEncuesta.find({ usuario_id: usuarioId });
  for (const v of votos) {
    await EncuestaDetalle.updateOne({ post_id: v.post_id }, { $inc: { [`votos.${v.opcion}`]: -1, total_votos: -1 } });
  }
  await VotoEncuesta.deleteMany({ usuario_id: usuarioId });

  // Sale de sus grupos, bajando el contador de cada uno. Los que creó
  // siguen existiendo (otros vecinos están en ellos), con la cuenta anónima
  // como creadora.
  const membresias = await MiembroGrupo.find({ usuario_id: usuarioId });
  for (const m of membresias) {
    await Grupo.updateOne({ _id: m.grupo_id, num_miembros: { $gt: 0 } }, { $inc: { num_miembros: -1 } });
  }
  await MiembroGrupo.deleteMany({ usuario_id: usuarioId });

  await Promise.all([
    Seguimiento.deleteMany({ $or: [{ seguidor_id: usuarioId }, { seguido_id: usuarioId }] }),
    Bloqueo.deleteMany({ $or: [{ bloqueador_id: usuarioId }, { bloqueado_id: usuarioId }] }),
    Notificacion.deleteMany({ usuario_id: usuarioId }),
    Suscripcion.deleteMany({ usuario_id: usuarioId }),
    // Sus negocios vuelven a no tener propietario (los podra reclamar otro).
    NegocioDetalle.updateMany({ propietario_id: usuarioId }, { propietario_id: null }),
    ReclamacionNegocio.deleteMany({ usuario_id: usuarioId, estado: 'pendiente' }),
  ]);

  const imagenesBorradas = await borrarImagenes([...posts.flatMap((p) => p.imagenes || []), usuario.avatar_url]);

  // Anonimizar. El correo y el nombre de usuario son unicos y obligatorios:
  // se sustituyen por valores que no dicen nada. La contraseña, por una
  // aleatoria que nadie conoce (y la cuenta queda inactiva de todas formas).
  const sufijo = crypto.randomBytes(4).toString('hex');
  usuario.nombre_usuario = `vecino-eliminado-${sufijo}`;
  usuario.nombre = 'Cuenta eliminada';
  usuario.apellidos = '';
  usuario.email = `eliminado-${usuario._id}@milepe.invalid`;
  usuario.contraseña = crypto.randomBytes(32).toString('hex');
  usuario.google_id = null;
  usuario.avatar_url = null;
  usuario.oficial = false;
  usuario.rol = 'usuario';
  usuario.activo = false;
  usuario.token_recuperacion = null;
  usuario.token_recuperacion_expira = null;
  usuario.token_verificacion = null;
  usuario.token_verificacion_expira = null;
  await usuario.save();

  return {
    publicaciones: posts.length,
    comentarios: comentarios.length,
    reacciones: reacciones.length,
    imagenes: imagenesBorradas,
  };
};
