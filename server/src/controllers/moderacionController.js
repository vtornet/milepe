import Post, { ESTADOS_MODERACION } from '../models/Post.js';
import Comentario from '../models/Comentario.js';
import Reporte, { ESTADOS_REPORTE } from '../models/Reporte.js';
import Apelacion from '../models/Apelacion.js';
import RegistroModeracion from '../models/RegistroModeracion.js';
import Notificacion from '../models/Notificacion.js';
import { TIPOS_CONTENIDO_MODERABLE, MOTIVOS_REPORTE, CAMPOS_PUBLICOS_USUARIO } from '../models/constantes.js';
import Mensaje from '../models/Mensaje.js';
import { cargarModerable, puedeReportar } from '../utils/contenidoModerable.js';
import ErrorHttp from '../utils/ErrorHttp.js';

// Que accion del registro corresponde a cada estado al que se mueve el
// contenido. 'publicado' es "restaurar" porque a este estado solo se llega
// deshaciendo algo.
// Lo que se le dice al autor, por tipo de contenido. Una frase completa
// por caso y no un sustantivo metido en una plantilla, porque en
// castellano hay que concordar: "publicacion" es femenina y "comentario"
// masculino, asi que "Tu <nombre> ha sido ocultad?" no se puede resolver
// con una sola cadena.
//
// Antes habia un solo juego de textos, el de los posts, asi que a quien le
// ocultaban un comentario le llegaba "Tu publicación ha sido ocultada".
const TEXTOS_ACCION = {
  post: {
    oculto: 'Tu publicación ha sido ocultada por un moderador',
    eliminado: 'Tu publicación ha sido eliminada por un moderador',
    publicado: 'Tu publicación vuelve a estar visible',
    auto: 'Tu publicación se ha ocultado automáticamente por acumular reportes y está pendiente de revisión',
  },
  comentario: {
    oculto: 'Tu comentario ha sido ocultado por un moderador',
    eliminado: 'Tu comentario ha sido eliminado por un moderador',
    publicado: 'Tu comentario vuelve a estar visible',
    auto: 'Tu comentario se ha ocultado automáticamente por acumular reportes y está pendiente de revisión',
  },
  mensaje: {
    oculto: 'Un mensaje privado tuyo ha sido ocultado por un moderador',
    eliminado: 'Un mensaje privado tuyo ha sido eliminado por un moderador',
    publicado: 'Tu mensaje vuelve a estar visible',
    auto: 'Un mensaje privado tuyo se ha ocultado automáticamente por acumular reportes',
  },
};

const textoDe = (contenidoTipo, clave) => (TEXTOS_ACCION[contenidoTipo] || TEXTOS_ACCION.post)[clave];

const ACCION_POR_ESTADO = {
  oculto: 'ocultar',
  eliminado: 'eliminar',
  publicado: 'restaurar',
};

const paginacion = (req) => ({
  pagina: Math.max(1, parseInt(req.query.pagina, 10) || 1),
  limite: Math.min(100, Math.max(1, parseInt(req.query.limite, 10) || 20)),
});

// Un moderador puede moderar su propio contenido (nada lo impide y a veces
// tiene sentido), pero entonces no hay que avisarle a si mismo.
const avisarAlAutor = async ({ autorId, actorId, mensaje, contenidoTipo, contenidoId }) => {
  if (actorId && autorId.equals(actorId)) return;

  await Notificacion.create({
    usuario_id: autorId,
    tipo: 'moderacion',
    mensaje,
    referencia_id: contenidoId,
    referencia_tipo: contenidoTipo,
  });
};

// Los reportes y las apelaciones apuntan a dos colecciones distintas segun
// contenido_tipo, asi que no hay populate posible: se trae el contenido en
// dos consultas (una por coleccion, no una por fila) y se empareja aqui.
// `contenido: null` significa que el documento ya no esta; no deberia pasar
// -nada se borra de verdad- pero es mas honesto que esconderlo.
const adjuntarContenido = async (filas) => {
  const idsPorTipo = { post: [], comentario: [] };
  for (const fila of filas) {
    idsPorTipo[fila.contenido_tipo]?.push(fila.contenido_id);
  }

  const [posts, comentarios] = await Promise.all([
    Post.find({ _id: { $in: idsPorTipo.post } })
      .select('tipo titulo contenido imagenes estado_moderacion autor_id fecha_creacion')
      .populate('autor_id', CAMPOS_PUBLICOS_USUARIO),
    Comentario.find({ _id: { $in: idsPorTipo.comentario } })
      .select('texto post_id estado_moderacion autor_id fecha_creacion')
      .populate('autor_id', CAMPOS_PUBLICOS_USUARIO),
  ]);

  const porId = new Map([...posts, ...comentarios].map((doc) => [String(doc._id), doc]));

  return filas.map((fila) => ({
    ...fila.toObject(),
    contenido: porId.get(String(fila.contenido_id)) || null,
  }));
};

// Quien tomo la ultima decision humana de moderacion sobre un contenido,
// leido del registro de auditoria. Se usa para que nadie resuelva la
// apelacion contra su propia decision: sin esto, apelar seria pedirle al
// mismo moderador que se corrija, o sea, un tramite vacio.
const moderadorQueActuo = async (contenidoTipo, contenidoId) => {
  const ultima = await RegistroModeracion.findOne({
    contenido_tipo: contenidoTipo,
    contenido_id: contenidoId,
    moderador_id: { $ne: null },
  })
    .sort({ fecha_creacion: -1 })
    .select('moderador_id');

  return ultima?.moderador_id || null;
};

// Aplica un cambio de estado_moderacion dejando constancia en el registro
// y avisando al autor. Es el unico camino por el que el estado de
// moderacion de un contenido cambia a mano: si se cambiase directamente en
// el modelo, la invariante "toda accion esta registrada" se rompe en
// silencio.
const aplicarAccion = async ({ contenido, contenidoTipo, estadoNuevo, moderador, nota, reporteId, apelacionId, accion }) => {
  const estadoAnterior = contenido.estado_moderacion;
  const cambiaEstado = estadoAnterior !== estadoNuevo;

  if (cambiaEstado) {
    contenido.estado_moderacion = estadoNuevo;
    contenido.moderador_id = moderador._id;
  }

  // Ocultar, eliminar o restaurar cierra ademas la revision por edicion si
  // habia una: el moderador acaba de mirar ese contenido, asi que seguir
  // en la cola solo serviria para que apareciese dos veces.
  const cierraRevision = contenido.revision_pendiente === true;
  if (cierraRevision) contenido.revision_pendiente = false;

  if (cambiaEstado || cierraRevision) {
    await contenido.save();
  }

  await RegistroModeracion.registrar({
    moderador_id: moderador._id,
    accion: accion || ACCION_POR_ESTADO[estadoNuevo],
    contenido_tipo: contenidoTipo,
    contenido_id: contenido._id,
    autor_contenido_id: contenido.autor_id,
    estado_anterior: estadoAnterior,
    estado_nuevo: estadoNuevo,
    nota: nota || null,
    reporte_id: reporteId || null,
    apelacion_id: apelacionId || null,
  });

  const texto = textoDe(contenidoTipo, estadoNuevo);

  if (estadoAnterior !== estadoNuevo) {
    await avisarAlAutor({
      autorId: contenido.autor_id,
      actorId: moderador._id,
      mensaje: nota ? `${texto}: ${nota}` : texto,
      contenidoTipo,
      contenidoId: contenido._id,
    });
  }

  return estadoAnterior;
};

// --- Ediciones (cola de revision) ---

// Deja constancia de que una edicion del autor cambio las imagenes y por
// eso entra en la cola. Lo llama postsController al editar: la escritura
// en el registro vive aqui, con el resto de la moderacion, para que no
// haya dos sitios distintos donde se anote lo que pasa con un contenido.
//
// No es un endpoint. Y no avisa al autor: desde su lado no ha pasado nada
// -su post sigue publicado y visible-, asi que una notificacion solo
// serviria para asustarle.
export const anotarRevisionPorEdicion = (post) =>
  RegistroModeracion.registrar({
    moderador_id: null,
    accion: 'revision_por_edicion',
    contenido_tipo: 'post',
    contenido_id: post._id,
    autor_contenido_id: post.autor_id,
    nota: 'El autor cambio las imagenes al editar',
  });

// Cola de ediciones por revisar. Es la tercera cola del panel, junto a
// reportes y apelaciones, y la unica que no significa que algo este
// escondido: aqui el contenido se sigue viendo mientras espera.
export const listarEdicionesPendientes = async (req, res, next) => {
  try {
    const { pagina, limite } = paginacion(req);

    const filtro = { revision_pendiente: true };

    const [posts, total] = await Promise.all([
      Post.find(filtro)
        .sort({ editado_en: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .populate('autor_id', CAMPOS_PUBLICOS_USUARIO),
      Post.countDocuments(filtro),
    ]);

    res.json({ ok: true, posts, total, pagina, limite });
  } catch (error) {
    next(error);
  }
};

// Visto bueno a una edicion: la saca de la cola sin tocar la visibilidad,
// que no se habia tocado. Si lo que quiere el moderador es lo contrario,
// ocultar o eliminar, eso ya existe (PATCH /contenido) y de paso cierra
// esta revision.
export const aprobarEdicion = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      throw new ErrorHttp(404, 'Publicacion no encontrada');
    }
    if (!post.revision_pendiente) {
      throw new ErrorHttp(400, 'Esta publicacion no esta en revision');
    }

    post.revision_pendiente = false;
    post.moderador_id = req.usuario._id;
    await post.save();

    await RegistroModeracion.registrar({
      moderador_id: req.usuario._id,
      accion: 'edicion_aprobada',
      contenido_tipo: 'post',
      contenido_id: post._id,
      autor_contenido_id: post.autor_id,
      nota: req.body?.nota || null,
    });

    res.json({ ok: true, post });
  } catch (error) {
    next(error);
  }
};

// --- Reportar (cualquier vecino con sesion) ---

// Endpoint generico: vale para un post y para un comentario, que antes no
// se podia reportar por separado. `POST /api/posts/:id/reportar` sigue
// existiendo y acaba aqui mismo, en reportarPost().
export const crearReporte = async (req, res, next) => {
  try {
    const { contenido_tipo, contenido_id, motivo, detalle } = req.body;

    if (!MOTIVOS_REPORTE.includes(motivo)) {
      throw new ErrorHttp(400, `motivo debe ser uno de: ${MOTIVOS_REPORTE.join(', ')}`);
    }

    const contenido = await cargarModerable(contenido_tipo, contenido_id);

    if (contenido.autor_id.equals(req.usuario._id)) {
      throw new ErrorHttp(400, 'No puedes reportar tu propio contenido');
    }

    // Un post o un comentario los ve cualquiera, asi que cualquiera puede
    // reportarlos. Un mensaje privado solo lo han visto dos personas, y
    // reportarlo es lo que lo pone delante de un moderador: ver
    // puedeReportar() para por que esto no es una formalidad. 404 y no
    // 403: a quien no es del hilo no se le confirma que ese mensaje
    // exista, igual que en cargarConversacionPropia.
    if (!(await puedeReportar(contenido_tipo, contenido, req.usuario._id))) {
      throw new ErrorHttp(404, 'El contenido indicado no existe');
    }

    if (contenido.estado_moderacion === 'eliminado') {
      throw new ErrorHttp(409, 'Este contenido ya ha sido eliminado');
    }

    let resultado;
    try {
      resultado = await Reporte.registrar({
        reportante_id: req.usuario._id,
        contenido_tipo,
        contenido,
        motivo,
        detalle,
      });
    } catch (error) {
      if (error.codigoDuplicado) {
        throw new ErrorHttp(409, error.message);
      }
      throw error;
    }

    if (resultado.autoOcultado) {
      await avisarAlAutor({
        autorId: contenido.autor_id,
        actorId: null, // lo oculto el umbral, no una persona
        mensaje: textoDe(contenido_tipo, 'auto'),
        contenidoTipo: contenido_tipo,
        contenidoId: contenido._id,
      });
    }

    res.status(201).json({
      ok: true,
      reporte: resultado.reporte,
      // Se le dice al que reporta que el contenido ya no esta visible, pero
      // no cuantos reportes hay ni de quien: eso es informacion de
      // moderacion y le serviria para medir el umbral.
      contenido_oculto: resultado.autoOcultado,
    });
  } catch (error) {
    next(error);
  }
};

// --- Cola de reportes (moderador/admin) ---

export const listarReportes = async (req, res, next) => {
  try {
    const { pagina, limite } = paginacion(req);

    const filtro = {};
    const estado = req.query.estado || 'pendiente';
    if (estado !== 'todos') {
      if (!ESTADOS_REPORTE.includes(estado)) {
        throw new ErrorHttp(400, `estado debe ser uno de: ${ESTADOS_REPORTE.join(', ')}, todos`);
      }
      filtro.estado = estado;
    }
    if (req.query.motivo) filtro.motivo = req.query.motivo;
    if (req.query.contenido_tipo) filtro.contenido_tipo = req.query.contenido_tipo;

    const [reportes, total] = await Promise.all([
      Reporte.find(filtro)
        // Los pendientes, los mas antiguos primero: una cola de revision se
        // atiende por orden de llegada, no como un feed.
        .sort({ fecha_creacion: estado === 'pendiente' ? 1 : -1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .populate('reportante_id autor_contenido_id moderador_id', CAMPOS_PUBLICOS_USUARIO),
      Reporte.countDocuments(filtro),
    ]);

    res.json({
      ok: true,
      reportes: await adjuntarContenido(reportes),
      total,
      pagina,
      limite,
    });
  } catch (error) {
    next(error);
  }
};

// Resolver un reporte. Aceptarlo puede ir acompañado de una accion sobre el
// contenido ('ocultar'/'eliminar') o de ninguna; rechazarlo nunca toca el
// contenido, pero si el umbral lo habia auto-ocultado hay que volver a
// publicarlo, porque si no "reporte rechazado" dejaria el castigo puesto.
export const resolverReporte = async (req, res, next) => {
  try {
    const { estado, accion = 'ninguna', nota } = req.body;

    if (!['aceptado', 'rechazado'].includes(estado)) {
      throw new ErrorHttp(400, "estado debe ser 'aceptado' o 'rechazado'");
    }
    if (!['ocultar', 'eliminar', 'ninguna'].includes(accion)) {
      throw new ErrorHttp(400, "accion debe ser 'ocultar', 'eliminar' o 'ninguna'");
    }
    if (estado === 'rechazado' && accion !== 'ninguna') {
      throw new ErrorHttp(400, 'Un reporte rechazado no puede llevar accion sobre el contenido');
    }

    const reporte = await Reporte.findById(req.params.id);
    if (!reporte) {
      throw new ErrorHttp(404, 'Reporte no encontrado');
    }
    if (reporte.estado !== 'pendiente') {
      throw new ErrorHttp(409, 'Este reporte ya estaba resuelto');
    }

    const contenido = await cargarModerable(reporte.contenido_tipo, reporte.contenido_id);

    reporte.estado = estado;
    reporte.moderador_id = req.usuario._id;
    reporte.fecha_revision = new Date();
    reporte.nota_moderador = nota || null;
    await reporte.save();

    await RegistroModeracion.registrar({
      moderador_id: req.usuario._id,
      accion: estado === 'aceptado' ? 'reporte_aceptado' : 'reporte_rechazado',
      contenido_tipo: reporte.contenido_tipo,
      contenido_id: reporte.contenido_id,
      autor_contenido_id: reporte.autor_contenido_id,
      nota: nota || null,
      reporte_id: reporte._id,
    });

    if (accion !== 'ninguna') {
      await aplicarAccion({
        contenido,
        contenidoTipo: reporte.contenido_tipo,
        estadoNuevo: accion === 'ocultar' ? 'oculto' : 'eliminado',
        moderador: req.usuario,
        nota,
        reporteId: reporte._id,
      });
    } else if (estado === 'rechazado' && contenido.estado_moderacion === 'oculto') {
      // Si no quedan otros reportes pendientes, lo que lo escondio fue este
      // (o el umbral contandolo), asi que descartarlo tiene que devolverlo
      // a su sitio.
      const pendientes = await Reporte.contarPendientes(reporte.contenido_tipo, reporte.contenido_id);
      if (pendientes === 0) {
        await aplicarAccion({
          contenido,
          contenidoTipo: reporte.contenido_tipo,
          estadoNuevo: 'publicado',
          moderador: req.usuario,
          nota: 'Reporte descartado: el contenido vuelve a publicarse',
          reporteId: reporte._id,
        });
      }
    }

    res.json({ ok: true, reporte, estado_contenido: contenido.estado_moderacion });
  } catch (error) {
    next(error);
  }
};

// --- Accion directa, sin reporte previo (moderador/admin) ---

// Generica para post y comentario. `PATCH /api/posts/:id/moderar` sigue
// funcionando igual que antes y acaba aqui, en moderarPost().
export const moderarContenido = async (req, res, next) => {
  try {
    const { contenido_tipo, contenido_id, estado_moderacion, nota } = req.body;

    if (!ESTADOS_MODERACION.includes(estado_moderacion)) {
      throw new ErrorHttp(400, `estado_moderacion debe ser uno de: ${ESTADOS_MODERACION.join(', ')}`);
    }

    const contenido = await cargarModerable(contenido_tipo, contenido_id);

    await aplicarAccion({
      contenido,
      contenidoTipo: contenido_tipo,
      estadoNuevo: estado_moderacion,
      moderador: req.usuario,
      nota,
    });

    res.json({ ok: true, contenido });
  } catch (error) {
    next(error);
  }
};

// --- Apelaciones ---

// Lo propio que esta oculto o eliminado, con su apelacion si ya la hay.
// Existe porque sin esto un autor no tiene forma de enterarse: el Muro y
// las secciones solo muestran lo publicado, asi que su post oculto
// simplemente desaparece y no habria desde donde apelar.
export const listarMiContenidoModerado = async (req, res, next) => {
  try {
    const noPublicado = { $in: ['oculto', 'eliminado'] };

    const [posts, comentarios, mensajes] = await Promise.all([
      Post.find({ autor_id: req.usuario._id, estado_moderacion: noPublicado })
        .sort({ fecha_actualizacion: -1 })
        .select('tipo titulo contenido estado_moderacion fecha_creacion'),
      // borrado_por_autor fuera: un comentario que retiraste tu no es una
      // sancion, y aqui apareceria como tal, con su boton de apelar al
      // lado, contra una decision que tomaste tu.
      Comentario.find({
        autor_id: req.usuario._id,
        estado_moderacion: noPublicado,
        borrado_por_autor: { $ne: true },
      })
        .sort({ fecha_actualizacion: -1 })
        .select('texto post_id estado_moderacion fecha_creacion'),
      // Los mensajes privados moderados tambien, o moderarlos seria una
      // sancion sin derecho a replica: sin esto su autor no se entera de
      // por que y no tiene desde donde apelar.
      Mensaje.find({ autor_id: req.usuario._id, estado_moderacion: noPublicado })
        .sort({ fecha_actualizacion: -1 })
        .select('texto conversacion_id estado_moderacion fecha_creacion'),
    ]);

    const apelaciones = await Apelacion.find({
      autor_id: req.usuario._id,
      contenido_id: { $in: [...posts, ...comentarios, ...mensajes].map((doc) => doc._id) },
    });
    const apelacionPorContenido = new Map(apelaciones.map((a) => [String(a.contenido_id), a]));

    // Se le da al autor el motivo de la ultima accion, que es lo minimo
    // para poder apelar con algo de criterio, pero no quien la tomo: saber
    // que moderador fue no le ayuda a defenderse y si invita a tomarselo
    // con la persona.
    const registros = await RegistroModeracion.find({
      autor_contenido_id: req.usuario._id,
      accion: { $in: ['ocultar', 'eliminar', 'auto_ocultar'] },
    })
      .sort({ fecha_creacion: -1 })
      .select('contenido_id accion nota fecha_creacion');
    const motivoPorContenido = new Map();
    for (const registro of registros) {
      const clave = String(registro.contenido_id);
      if (!motivoPorContenido.has(clave)) motivoPorContenido.set(clave, registro);
    }

    const montar = (doc, contenidoTipo) => ({
      contenido_tipo: contenidoTipo,
      contenido: doc,
      ultima_accion: motivoPorContenido.get(String(doc._id)) || null,
      apelacion: apelacionPorContenido.get(String(doc._id)) || null,
    });

    res.json({
      ok: true,
      contenido: [
        ...posts.map((doc) => montar(doc, 'post')),
        ...comentarios.map((doc) => montar(doc, 'comentario')),
        ...mensajes.map((doc) => montar(doc, 'mensaje')),
      ],
    });
  } catch (error) {
    next(error);
  }
};

export const crearApelacion = async (req, res, next) => {
  try {
    const { contenido_tipo, contenido_id, texto } = req.body;

    const contenido = await cargarModerable(contenido_tipo, contenido_id);

    if (!contenido.autor_id.equals(req.usuario._id)) {
      throw new ErrorHttp(403, 'Solo el autor del contenido puede apelar');
    }

    // Apelar algo que esta publicado no significa nada: no hay decision
    // que revisar.
    if (contenido.estado_moderacion === 'publicado') {
      throw new ErrorHttp(400, 'Este contenido está visible: no hay ninguna decisión que apelar');
    }

    let apelacion;
    try {
      apelacion = await Apelacion.create({
        autor_id: req.usuario._id,
        contenido_tipo,
        contenido_id,
        texto,
      });
    } catch (error) {
      if (error.code === 11000) {
        throw new ErrorHttp(409, 'Ya habías apelado esta decisión y la resolución es definitiva');
      }
      throw error;
    }

    res.status(201).json({ ok: true, apelacion });
  } catch (error) {
    next(error);
  }
};

export const listarApelaciones = async (req, res, next) => {
  try {
    const { pagina, limite } = paginacion(req);

    const filtro = {};
    const estado = req.query.estado || 'pendiente';
    if (estado !== 'todos') filtro.estado = estado;

    const [apelaciones, total] = await Promise.all([
      Apelacion.find(filtro)
        .sort({ fecha_creacion: estado === 'pendiente' ? 1 : -1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .populate('autor_id revisor_id', CAMPOS_PUBLICOS_USUARIO),
      Apelacion.countDocuments(filtro),
    ]);

    res.json({ ok: true, apelaciones: await adjuntarContenido(apelaciones), total, pagina, limite });
  } catch (error) {
    next(error);
  }
};

// Resolver una apelacion. Aceptarla restaura el contenido; rechazarla lo
// deja como estaba. En los dos casos hace falta una respuesta escrita: una
// apelacion rechazada sin explicacion equivale a no haber contestado.
export const resolverApelacion = async (req, res, next) => {
  try {
    const { estado, respuesta } = req.body;

    if (!['aceptada', 'rechazada'].includes(estado)) {
      throw new ErrorHttp(400, "estado debe ser 'aceptada' o 'rechazada'");
    }
    if (!respuesta || !respuesta.trim()) {
      throw new ErrorHttp(400, 'Hay que explicarle al autor por que se acepta o se rechaza su apelacion');
    }

    const apelacion = await Apelacion.findById(req.params.id);
    if (!apelacion) {
      throw new ErrorHttp(404, 'Apelacion no encontrada');
    }
    if (apelacion.estado !== 'pendiente') {
      throw new ErrorHttp(409, 'Esta apelacion ya estaba resuelta');
    }

    // Nadie revisa su propia decision. Se mira en el registro de
    // auditoria, que es quien sabe quien actuo; con Post.moderador_id no
    // bastaria, porque ese campo se sobrescribe en cada accion.
    const autorDeLaDecision = await moderadorQueActuo(apelacion.contenido_tipo, apelacion.contenido_id);
    if (autorDeLaDecision && autorDeLaDecision.equals(req.usuario._id)) {
      throw new ErrorHttp(403, 'No puedes resolver una apelacion contra tu propia decision de moderacion');
    }

    const contenido = await cargarModerable(apelacion.contenido_tipo, apelacion.contenido_id);

    apelacion.estado = estado;
    apelacion.revisor_id = req.usuario._id;
    apelacion.fecha_revision = new Date();
    apelacion.respuesta = respuesta.trim();
    await apelacion.save();

    await RegistroModeracion.registrar({
      moderador_id: req.usuario._id,
      accion: estado === 'aceptada' ? 'apelacion_aceptada' : 'apelacion_rechazada',
      contenido_tipo: apelacion.contenido_tipo,
      contenido_id: apelacion.contenido_id,
      autor_contenido_id: apelacion.autor_id,
      nota: apelacion.respuesta,
      apelacion_id: apelacion._id,
    });

    if (estado === 'aceptada') {
      // Se dan por resueltos los reportes que seguian pendientes sobre ese
      // contenido: si la apelacion se acepta, la decision era equivocada y
      // dejarlos en la cola haria que el umbral lo volviese a ocultar.
      await Reporte.updateMany(
        { contenido_tipo: apelacion.contenido_tipo, contenido_id: apelacion.contenido_id, estado: 'pendiente' },
        {
          $set: {
            estado: 'rechazado',
            moderador_id: req.usuario._id,
            fecha_revision: new Date(),
            nota_moderador: 'Descartado al aceptarse la apelacion del autor',
          },
        },
      );

      await aplicarAccion({
        contenido,
        contenidoTipo: apelacion.contenido_tipo,
        estadoNuevo: 'publicado',
        moderador: req.usuario,
        nota: apelacion.respuesta,
        apelacionId: apelacion._id,
        accion: 'apelacion_aceptada',
      });
    } else {
      await avisarAlAutor({
        autorId: apelacion.autor_id,
        actorId: req.usuario._id,
        mensaje: `Tu apelación ha sido rechazada: ${apelacion.respuesta}`,
        contenidoTipo: apelacion.contenido_tipo,
        contenidoId: apelacion.contenido_id,
      });
    }

    res.json({ ok: true, apelacion, estado_contenido: contenido.estado_moderacion });
  } catch (error) {
    next(error);
  }
};

// --- Registro de auditoria (moderador/admin) ---

export const listarRegistro = async (req, res, next) => {
  try {
    const { pagina, limite } = paginacion(req);

    const filtro = {};
    if (req.query.contenido_id) filtro.contenido_id = req.query.contenido_id;
    if (req.query.contenido_tipo) filtro.contenido_tipo = req.query.contenido_tipo;
    if (req.query.autor_contenido_id) filtro.autor_contenido_id = req.query.autor_contenido_id;
    if (req.query.moderador_id) filtro.moderador_id = req.query.moderador_id;
    if (req.query.accion) filtro.accion = req.query.accion;

    const [registro, total] = await Promise.all([
      RegistroModeracion.find(filtro)
        .sort({ fecha_creacion: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .populate('moderador_id autor_contenido_id', CAMPOS_PUBLICOS_USUARIO),
      RegistroModeracion.countDocuments(filtro),
    ]);

    res.json({ ok: true, registro, total, pagina, limite });
  } catch (error) {
    next(error);
  }
};

// Resumen para la cabecera del panel: cuanto hay esperando. Evita que el
// moderador tenga que abrir las dos colas para ver si hay algo que hacer.
export const resumenPendientes = async (req, res, next) => {
  try {
    const [reportes, apelaciones, ediciones] = await Promise.all([
      Reporte.countDocuments({ estado: 'pendiente' }),
      Apelacion.countDocuments({ estado: 'pendiente' }),
      Post.countDocuments({ revision_pendiente: true }),
    ]);

    res.json({
      ok: true,
      reportes_pendientes: reportes,
      apelaciones_pendientes: apelaciones,
      ediciones_pendientes: ediciones,
    });
  } catch (error) {
    next(error);
  }
};

// Catalogos para que el cliente no repita los enums a mano.
export const listarCatalogos = (req, res) => {
  res.json({
    ok: true,
    motivos_reporte: MOTIVOS_REPORTE,
    tipos_contenido: TIPOS_CONTENIDO_MODERABLE,
    estados_moderacion: ESTADOS_MODERACION,
  });
};
