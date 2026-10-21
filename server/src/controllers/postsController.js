import Post from '../models/Post.js';
import Comentario from '../models/Comentario.js';
import Reaccion, { TIPOS_REACCION } from '../models/Reaccion.js';
import Bloqueo from '../models/Bloqueo.js';
import Notificacion from '../models/Notificacion.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { crearReporte, moderarContenido, anotarRevisionPorEdicion } from './moderacionController.js';
import { CAMPOS_PUBLICOS_USUARIO } from '../models/constantes.js';

// Un post 'eliminado' es borrado logico: para cualquiera que no sea su
// autor o un moderador, se comporta como si no existiera.
const noEsVisible = (post) => !post || post.estado_moderacion === 'eliminado';

// Nunca te notificas a ti mismo (comentar/reaccionar en lo tuyo propio).
// Centralizado aqui porque los tres disparadores de este archivo
// (comentario, reaccion a post, reaccion a comentario) repiten la misma
// comprobacion.
const notificarSiNoEsUnoMismo = async ({ destinatarioId, autorAccionId, ...datos }) => {
  if (destinatarioId.equals(autorAccionId)) return;
  await Notificacion.create({ usuario_id: destinatarioId, ...datos });
};

// Muro: feed general, todas las secciones a la vez, sin joins. Filtro
// opcional por tipo (lo usa cada seccion si alguna vez necesita reutilizar
// este listado en vez de tener el suyo propio con su detalle).
export const listarMuro = async (req, res, next) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 20));

    const filtro = { estado_moderacion: 'publicado' };
    if (req.query.tipo) filtro.tipo = req.query.tipo;

    const [posts, total] = await Promise.all([
      Post.find(filtro)
        .sort({ fecha_creacion: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .populate('autor_id', CAMPOS_PUBLICOS_USUARIO),
      Post.countDocuments(filtro),
    ]);

    res.json({
      ok: true,
      posts,
      paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (error) {
    next(error);
  }
};

export const obtenerPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate('autor_id', CAMPOS_PUBLICOS_USUARIO);

    if (noEsVisible(post)) {
      throw new ErrorHttp(404, 'Publicacion no encontrada');
    }

    res.json({ ok: true, post });
  } catch (error) {
    next(error);
  }
};

// Da, cambia o quita la reaccion del usuario autenticado sobre un post.
// Toggle: reaccionar otra vez con el mismo tipo la quita; con uno distinto,
// la cambia. body: { tipo: 'me_gusta' | 'me_encanta' | 'apoyo' | 'triste' }.
export const reaccionarPost = async (req, res, next) => {
  try {
    const { tipo } = req.body;

    if (!TIPOS_REACCION.includes(tipo)) {
      throw new ErrorHttp(400, `tipo debe ser uno de: ${TIPOS_REACCION.join(', ')}`);
    }

    const post = await Post.findById(req.params.id);
    if (noEsVisible(post)) {
      throw new ErrorHttp(404, 'Publicacion no encontrada');
    }

    if (await Bloqueo.existeEntre(req.usuario._id, post.autor_id)) {
      throw new ErrorHttp(403, 'No puedes reaccionar a esta publicacion');
    }

    const resultado = await Reaccion.alternar({ autor_id: req.usuario._id, tipo, post_id: post._id });
    const postActualizado = await Post.findById(post._id).select('reacciones_resumen');

    // Quitar una reaccion no notifica nada; solo darla o cambiarla.
    if (resultado.accion !== 'quitada') {
      await notificarSiNoEsUnoMismo({
        destinatarioId: post.autor_id,
        autorAccionId: req.usuario._id,
        tipo: 'reaccion',
        mensaje: `${req.usuario.nombre_usuario} ha reaccionado a tu publicacion`,
        referencia_id: post._id,
        referencia_tipo: 'post',
      });
    }

    res.json({ ok: true, ...resultado, reacciones: postActualizado.reacciones_resumen });
  } catch (error) {
    next(error);
  }
};

// Cuantas reacciones propias se devuelven de una vez. Hay tope porque la
// respuesta se pide entera de una sola vez, no paginada: con mil ya se
// cubre a cualquier vecino de un pueblo, y lo que se pierde al pasarse es
// que una reaccion de hace años no salga marcada, no que deje de funcionar.
const TOPE_MIS_REACCIONES = 1000;

// Que ha reaccionado el usuario que pregunta, todo de una vez: un mapa
// id -> tipo para posts y otro para comentarios.
//
// Es una sola peticion por carga de la aplicacion, y no un campo
// "mi_reaccion" añadido a cada listado, por dos razones: los siete
// listados (muro y seis secciones) tendrian que calcularlo cada uno, dos
// de ellos con agregacion; y el selector de reacciones vive dentro de una
// tarjeta que no sabe de donde viene, asi que preguntando una vez aqui
// funciona igual en el muro, en cada seccion y en las que vengan.
//
// Sin esto, al recargar la pagina tu propia reaccion no salia marcada: el
// cliente arrancaba siempre sin saber que habias puesto.
export const listarMisReacciones = async (req, res, next) => {
  try {
    const reacciones = await Reaccion.find({ autor_id: req.usuario._id })
      .sort({ fecha_creacion: -1 })
      .limit(TOPE_MIS_REACCIONES)
      .select('tipo post_id comentario_id');

    const posts = {};
    const comentarios = {};

    for (const reaccion of reacciones) {
      if (reaccion.post_id) posts[reaccion.post_id] = reaccion.tipo;
      else if (reaccion.comentario_id) comentarios[reaccion.comentario_id] = reaccion.tipo;
    }

    res.json({ ok: true, posts, comentarios });
  } catch (error) {
    next(error);
  }
};

// Lo unico que se puede cambiar al editar. Lista blanca y no "todo lo que
// venga menos esto", misma disciplina que authController.registrar: con la
// lista negra, cualquier campo nuevo del esquema queda editable desde
// fuera el dia que se añade, sin que nadie se de cuenta.
const CAMPOS_EDITABLES_POST = ['titulo', 'contenido', 'imagenes'];

// Edita una publicacion. Generico, como reaccionar o reportar: sirve igual
// para una queja que para un negocio, porque solo toca los campos que
// viven en Post. Los campos propios de cada seccion (la categoria de una
// queja, la fecha de un evento, la direccion de un negocio) estan en su
// *_detalle y no se editan desde aqui.
export const editarPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (noEsVisible(post)) {
      throw new ErrorHttp(404, 'Publicacion no encontrada');
    }

    // Solo el autor, y esto se comprueba aqui: un moderador puede ocultar
    // o eliminar lo de otro, que es distinto de reescribirlo en su nombre.
    if (!post.autor_id.equals(req.usuario._id)) {
      throw new ErrorHttp(403, 'Solo el autor puede editar su publicacion');
    }

    // Un post oculto no se edita: dejaria al moderador resolviendo un
    // reporte sobre un texto que ya no es el que se reporto.
    if (post.estado_moderacion !== 'publicado') {
      throw new ErrorHttp(400, 'No puedes editar una publicacion que esta oculta por moderacion');
    }

    const cambios = {};
    for (const campo of CAMPOS_EDITABLES_POST) {
      if (req.body[campo] !== undefined) cambios[campo] = req.body[campo];
    }

    if (Object.keys(cambios).length === 0) {
      throw new ErrorHttp(400, `Indica que quieres cambiar: ${CAMPOS_EDITABLES_POST.join(', ')}`);
    }

    if (cambios.imagenes !== undefined) {
      if (!Array.isArray(cambios.imagenes) || cambios.imagenes.some((url) => typeof url !== 'string' || !url.trim())) {
        throw new ErrorHttp(400, 'imagenes debe ser una lista de URLs');
      }
      // Una foto sin foto no es nada. La seccion lo exige al crearla y
      // tiene que seguir exigiendolo al editar, o se podria dejar vacia
      // por la puerta de atras.
      if (post.tipo === 'foto' && cambios.imagenes.length === 0) {
        throw new ErrorHttp(400, 'Una publicacion de Fotos no puede quedarse sin imagenes');
      }
    }

    const { imagenesCambiaron } = post.aplicarEdicion(cambios);
    await post.save();

    // Cambiar el texto no vuelve a revision; cambiar las imagenes si. Una
    // imagen nueva es contenido que nadie ha visto todavia, y es la via
    // obvia para colar algo detras de un texto ya aceptado.
    if (imagenesCambiaron) {
      await anotarRevisionPorEdicion(post);
    }

    await post.populate('autor_id', CAMPOS_PUBLICOS_USUARIO);

    res.json({ ok: true, post, en_revision: post.revision_pendiente });
  } catch (error) {
    next(error);
  }
};

// Historial de ediciones: el autor, para ver lo que escribio, y el equipo
// de moderacion, que es quien necesita comparar con que se publico algo y
// en que se ha quedado cuando le llega una revision por cambio de imagen.
// Nadie mas: el historial tiene versiones que su autor decidio retirar.
export const listarEdiciones = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      throw new ErrorHttp(404, 'Publicacion no encontrada');
    }

    const esAutor = post.autor_id.equals(req.usuario._id);
    const esEquipo = req.usuario.rol === 'moderador' || req.usuario.rol === 'admin';

    if (!esAutor && !esEquipo) {
      throw new ErrorHttp(403, 'No puedes ver el historial de esta publicacion');
    }

    res.json({
      ok: true,
      // De la mas reciente a la mas vieja, como el registro de moderacion.
      ediciones: [...post.historial_ediciones].reverse(),
      // La version de ahora va aparte y marcada, para que quien lo lea no
      // tenga que adivinar cual de las filas es la que esta publicada.
      actual: { titulo: post.titulo, texto: post.contenido, imagenes: post.imagenes },
      editado_en: post.editado_en,
      revision_pendiente: post.revision_pendiente,
    });
  } catch (error) {
    next(error);
  }
};

// Reportar y moderar son ahora genericos (valen igual para un post que
// para un comentario) y viven en moderacionController. Estas dos rutas se
// mantienen porque /api/posts/:id/... es donde tiene sentido buscarlas, y
// se limitan a rellenar el contenido_tipo/contenido_id que el controlador
// generico espera en el cuerpo. Toda la logica -umbral de auto-ocultado,
// registro de auditoria, aviso al autor- esta alli, en un solo sitio.
export const reportarPost = (req, res, next) => {
  req.body = { ...req.body, contenido_tipo: 'post', contenido_id: req.params.id };
  return crearReporte(req, res, next);
};

export const moderarPost = (req, res, next) => {
  req.body = { ...req.body, contenido_tipo: 'post', contenido_id: req.params.id };
  return moderarContenido(req, res, next);
};

// Niveles del hilo que el cliente dibuja con sangrado. Vive aqui por
// documentacion: el servidor NO limita la profundidad -se puede responder
// a una respuesta indefinidamente, y padre_id lo soporta-; es el cliente
// el que deja de sangrar y ofrece "continuar hilo" para no acabar con una
// columna de texto de dos palabras de ancho en un movil.
export const NIVELES_SANGRADO = 3;

// Un comentario retirado (por su autor o por un moderador) se devuelve
// como hueco: la fila se conserva para no romper el hilo que cuelga de
// ella, pero el texto y el autor NO viajan.
//
// Que no viajen es el punto. Si fueran en la respuesta y el cliente se
// limitase a pintar "[eliminado]" encima, el borrado seria un adorno:
// cualquiera que mirase la respuesta de la API -o la pestana de red del
// navegador- seguiria leyendo lo que su autor retiro.
const paraElCliente = (comentario) => {
  if (comentario.estado_moderacion === 'publicado') return comentario.toJSON();

  return {
    _id: comentario._id,
    post_id: comentario.post_id,
    padre_id: comentario.padre_id,
    profundidad: comentario.profundidad,
    num_respuestas: comentario.num_respuestas,
    fecha_creacion: comentario.fecha_creacion,
    // Quien lo retiro cambia lo que hay que poner en pantalla: "lo borro
    // su autor" y "lo quito un moderador" no son lo mismo para quien lee.
    retirado: comentario.borrado_por_autor ? 'autor' : 'moderacion',
  };
};

// Un nivel del hilo: las raices del post, o las respuestas de un
// comentario si viene ?padre=<id>.
//
// Paginado y por niveles en vez de todo de golpe: un post con doscientos
// comentarios mandaba doscientos comentarios para ensenar los cinco
// primeros. Las respuestas se piden solo cuando alguien pulsa "ver N
// respuestas", que es lo que la mayoria no hace.
export const listarComentarios = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (noEsVisible(post)) {
      throw new ErrorHttp(404, 'Publicacion no encontrada');
    }

    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 10));

    // Sin ?padre, las raices: padre_id null no es un caso aparte, es solo
    // otro valor del mismo filtro.
    const filtro = { post_id: post._id, padre_id: req.query.padre || null };

    const [comentarios, total] = await Promise.all([
      Comentario.find(filtro)
        .sort({ fecha_creacion: 1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .populate('autor_id', CAMPOS_PUBLICOS_USUARIO),
      Comentario.countDocuments(filtro),
    ]);

    res.json({
      ok: true,
      comentarios: comentarios.map(paraElCliente),
      paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
      // Para que el cliente no repita a mano un numero que se decide aqui.
      niveles_sangrado: NIVELES_SANGRADO,
    });
  } catch (error) {
    next(error);
  }
};

export const crearComentario = async (req, res, next) => {
  try {
    const { texto, valoracion, padre_id } = req.body;

    const post = await Post.findById(req.params.id);
    if (noEsVisible(post)) {
      throw new ErrorHttp(404, 'Publicacion no encontrada');
    }

    if (await Bloqueo.existeEntre(req.usuario._id, post.autor_id)) {
      throw new ErrorHttp(403, 'No puedes comentar en esta publicacion');
    }

    // A quien se avisa: al autor del comentario si es una respuesta, al del
    // post si es de primer nivel. Solo a uno. Avisar tambien al autor del
    // post de cada respuesta de cada hilo convierte el panel de avisos en
    // un contador que nadie mira.
    let destinatario = post.autor_id;
    let mensaje = `${req.usuario.nombre_usuario} ha comentado en tu publicacion`;

    if (padre_id) {
      const padre = await Comentario.findOne({ _id: padre_id, post_id: post._id }).select('autor_id');
      if (!padre) {
        throw new ErrorHttp(404, 'El comentario al que respondes no existe');
      }
      // El mismo bloqueo que para comentar, ahora con la persona a la que
      // se responde: sin esto, alguien a quien has bloqueado no puede
      // escribirte en tu publicacion pero si colgarse de tu comentario en
      // la de otro.
      if (await Bloqueo.existeEntre(req.usuario._id, padre.autor_id)) {
        throw new ErrorHttp(403, 'No puedes responder a este comentario');
      }

      destinatario = padre.autor_id;
      mensaje = `${req.usuario.nombre_usuario} ha respondido a tu comentario`;
    }

    const comentario = await Comentario.create({
      post_id: post._id,
      autor_id: req.usuario._id,
      texto,
      valoracion,
      // La profundidad la calcula el modelo a partir del padre: aqui no se
      // pasa, a proposito.
      padre_id: padre_id || null,
    });

    await comentario.populate('autor_id', CAMPOS_PUBLICOS_USUARIO);

    await notificarSiNoEsUnoMismo({
      destinatarioId: destinatario,
      autorAccionId: req.usuario._id,
      tipo: 'comentario',
      mensaje,
      referencia_id: post._id,
      referencia_tipo: 'post',
    });

    res.status(201).json({ ok: true, comentario });
  } catch (error) {
    next(error);
  }
};

// Carga un comentario del post de la URL. Que pertenezca a ese post se
// comprueba en la propia consulta, no despues: asi el id de un comentario
// de otra publicacion da 404 en vez de colarse por la puerta de al lado.
const cargarComentario = async (req) => {
  const comentario = await Comentario.findOne({ _id: req.params.comentarioId, post_id: req.params.id });
  if (!comentario) {
    throw new ErrorHttp(404, 'Comentario no encontrado');
  }
  return comentario;
};

// Editar el texto de un comentario propio. No guarda historial de
// versiones, al contrario que un post: un comentario son dos lineas, lo
// que se corrige casi siempre es una falta, y guardar cada version de cada
// comentario de cada hilo es mucho peso para lo que da. Que esta editado
// si se dice, porque debajo puede haber respuestas a lo que decia antes.
export const editarComentario = async (req, res, next) => {
  try {
    const comentario = await cargarComentario(req);

    if (!comentario.autor_id.equals(req.usuario._id)) {
      throw new ErrorHttp(403, 'Solo el autor puede editar su comentario');
    }
    if (comentario.estado_moderacion !== 'publicado') {
      throw new ErrorHttp(400, 'No puedes editar un comentario retirado');
    }

    const texto = typeof req.body.texto === 'string' ? req.body.texto.trim() : '';
    if (!texto) {
      throw new ErrorHttp(400, 'El texto del comentario es obligatorio');
    }

    comentario.texto = texto;
    comentario.editado = true;
    comentario.editado_en = new Date();
    await comentario.save();

    await comentario.populate('autor_id', CAMPOS_PUBLICOS_USUARIO);

    res.json({ ok: true, comentario });
  } catch (error) {
    next(error);
  }
};

// Retirar un comentario. Dos caminos distintos segun quien pulse, a
// proposito:
//
// - Su autor: borrado blando directo, con borrado_por_autor. No es una
//   accion de moderacion, asi que no escribe en el registro de auditoria
//   ni se manda un aviso a si mismo.
// - Un moderador sobre lo de otro: eso si lo es, asi que pasa por
//   moderarContenido, el camino de siempre, que deja constancia en el
//   registro y avisa al autor con el motivo para que pueda apelar.
//
// En los dos casos el documento se queda: lo exige el hilo que cuelga de
// el. Lo que desaparece es el texto, que ya no sale ni por la API.
export const borrarComentario = async (req, res, next) => {
  try {
    const comentario = await cargarComentario(req);

    const esAutor = comentario.autor_id.equals(req.usuario._id);
    const esEquipo = req.usuario.rol === 'moderador' || req.usuario.rol === 'admin';

    if (!esAutor && !esEquipo) {
      throw new ErrorHttp(403, 'No puedes borrar este comentario');
    }

    // Repetir la operacion no es un error: con mala cobertura se pulsa dos
    // veces, y un 400 ahi solo asusta. Contesta lo mismo que la primera.
    if (comentario.estado_moderacion === 'eliminado') {
      res.json({ ok: true, comentario: paraElCliente(comentario) });
      return;
    }

    // Un moderador borrando SU PROPIO comentario es un autor, no un
    // moderador: no tiene sentido abrirse un expediente a si mismo.
    if (!esAutor) {
      req.body = {
        contenido_tipo: 'comentario',
        contenido_id: String(comentario._id),
        estado_moderacion: 'eliminado',
        nota: req.body?.nota,
      };
      moderarContenido(req, res, next);
      return;
    }

    comentario.borrado_por_autor = true;
    comentario.estado_moderacion = 'eliminado';
    // Los hooks del modelo descuentan Post.num_comentarios.
    await comentario.save();

    res.json({ ok: true, comentario: paraElCliente(comentario) });
  } catch (error) {
    next(error);
  }
};

// Igual que reaccionarPost pero sobre un comentario. Vive aqui (no en su
// propia ruta /comentarios) porque comparte el mismo prefijo /:id que el
// resto de acciones sobre un post; el comentario se referencia por su
// propio id en el body, no en la URL.
export const reaccionarComentario = async (req, res, next) => {
  try {
    const { tipo, comentario_id } = req.body;

    if (!TIPOS_REACCION.includes(tipo)) {
      throw new ErrorHttp(400, `tipo debe ser uno de: ${TIPOS_REACCION.join(', ')}`);
    }
    if (!comentario_id) {
      throw new ErrorHttp(400, 'comentario_id es obligatorio');
    }

    const comentario = await Comentario.findOne({ _id: comentario_id, post_id: req.params.id });
    if (!comentario || comentario.estado_moderacion === 'eliminado') {
      throw new ErrorHttp(404, 'Comentario no encontrado');
    }

    const resultado = await Reaccion.alternar({ autor_id: req.usuario._id, tipo, comentario_id });
    const comentarioActualizado = await Comentario.findById(comentario_id).select('reacciones_resumen');

    if (resultado.accion !== 'quitada') {
      await notificarSiNoEsUnoMismo({
        destinatarioId: comentario.autor_id,
        autorAccionId: req.usuario._id,
        tipo: 'reaccion',
        mensaje: `${req.usuario.nombre_usuario} ha reaccionado a tu comentario`,
        referencia_id: comentario.post_id,
        referencia_tipo: 'post',
      });
    }

    res.json({ ok: true, ...resultado, reacciones: comentarioActualizado.reacciones_resumen });
  } catch (error) {
    next(error);
  }
};
