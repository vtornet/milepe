import Usuario from '../models/Usuario.js';
import Bloqueo from '../models/Bloqueo.js';
import Seguimiento from '../models/Seguimiento.js';
import Post from '../models/Post.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { CAMPOS_PUBLICOS_USUARIO } from '../models/constantes.js';
import { eliminarCuenta, exportarDatos } from '../utils/datosPersonales.js';

export const bloquearUsuario = async (req, res, next) => {
  try {
    const bloqueadoId = req.params.id;

    const existe = await Usuario.exists({ _id: bloqueadoId });
    if (!existe) {
      throw new ErrorHttp(404, 'Usuario no encontrado');
    }

    try {
      await Bloqueo.create({ bloqueador_id: req.usuario._id, bloqueado_id: bloqueadoId });
    } catch (error) {
      // El indice unico compuesto {bloqueador_id, bloqueado_id} ya lo
      // impide, pero el mensaje generico del gestor de errores (que solo
      // mira la primera clave de un indice compuesto) queda confuso aqui.
      if (error.code === 11000) {
        throw new ErrorHttp(409, 'Ya tenias bloqueado a este usuario');
      }
      throw error;
    }

    // Bloquear rompe el seguimiento en los DOS sentidos. Seguir
    // apareciendo en la lista de seguidores de alguien a quien has
    // bloqueado le mantendria abierto el canal de mensajes privados (que
    // se abre con el seguimiento mutuo), o sea que no habrias bloqueado
    // nada. Y no solo el sentido propio: si solo se borrase "yo le sigo",
    // el suyo seguiria ahi y la lista de el seguiria contandote.
    await Seguimiento.romperEnAmbosSentidos(req.usuario._id, bloqueadoId);

    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const desbloquearUsuario = async (req, res, next) => {
  try {
    const resultado = await Bloqueo.deleteOne({ bloqueador_id: req.usuario._id, bloqueado_id: req.params.id });

    if (resultado.deletedCount === 0) {
      throw new ErrorHttp(404, 'No tenias bloqueado a este usuario');
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const listarBloqueados = async (req, res, next) => {
  try {
    const bloqueos = await Bloqueo.find({ bloqueador_id: req.usuario._id }).populate(
      'bloqueado_id',
      CAMPOS_PUBLICOS_USUARIO,
    );

    res.json({ ok: true, bloqueados: bloqueos.map((b) => b.bloqueado_id) });
  } catch (error) {
    next(error);
  }
};

// Escapa lo que el usuario escribe antes de meterlo en una RegExp: sin
// esto, un '(' o un '*' sueltos en el buscador no son una busqueda raruna,
// son una RegExp invalida que revienta la consulta con un 500.
const escaparRegExp = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Buscador de vecinos por nombre de usuario o nombre. Existe porque sin el
// la mensajeria no tendria por donde empezar una conversacion (no hay
// pagina de perfil todavia); el sistema de amigos lo reutilizara igual.
// Devuelve solo campos publicos, un maximo de 10 resultados, y ni a quien
// busca ni a nadie con quien medie un bloqueo: si no puedes escribirle ni
// enviarle solicitud, sacarlo en el buscador solo lleva a un 403.
export const buscarUsuarios = async (req, res, next) => {
  try {
    const consulta = (req.query.q || '').trim();

    // Con menos de dos caracteres la busqueda devolveria media base de
    // datos sin informar de nada.
    if (consulta.length < 2) {
      res.json({ ok: true, usuarios: [] });
      return;
    }

    const patron = new RegExp(escaparRegExp(consulta), 'i');

    const bloqueos = await Bloqueo.find({
      $or: [{ bloqueador_id: req.usuario._id }, { bloqueado_id: req.usuario._id }],
    }).select('bloqueador_id bloqueado_id');

    const excluidos = [req.usuario._id];
    for (const bloqueo of bloqueos) {
      excluidos.push(bloqueo.bloqueador_id, bloqueo.bloqueado_id);
    }

    const usuarios = await Usuario.find({
      _id: { $nin: excluidos },
      activo: true,
      $or: [{ nombre_usuario: patron }, { nombre: patron }],
    })
      .select(CAMPOS_PUBLICOS_USUARIO)
      .limit(10);

    res.json({ ok: true, usuarios });
  } catch (error) {
    next(error);
  }
};

// --- Perfil propio ---

// Los campos privados (nombre y apellidos reales) tienen select: false en
// el modelo, asi que hay que pedirlos explicitamente. Solo se devuelven
// aqui, en el perfil de uno mismo: en cualquier otra respuesta el usuario
// viaja con CAMPOS_PUBLICOS_USUARIO, que no los incluye.
export const miPerfil = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id).select('+nombre +apellidos +contraseña');
    res.json({
      ok: true,
      usuario: {
        ...usuario.toJSON(),
        nombre: usuario.nombre,
        apellidos: usuario.apellidos,
        // Solo si la tiene, nunca cual: el perfil lo usa para pedir la
        // contraseña o un "ELIMINAR" al dar de baja una cuenta de Google.
        tiene_contraseña: Boolean(usuario.contraseña),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Actualiza el perfil propio.
//
// nombre_usuario se puede elegir UNA vez y nunca mas. Dos motivos: sale en
// cada publicacion y cada comentario que uno escribe, asi que cambiarlo
// reescribiria la autoria de todo su historial a ojos de los demas; y es
// como el resto de vecinos te reconocen. Quien se registro con Google
// nunca lo eligio (se le invento uno a partir del correo), asi que este es
// su momento de ponerle el que quiera.
//
// Al guardar con todos los datos obligatorios, perfil_completo pasa a true
// y se abre la puerta a publicar. Es el servidor quien lo decide: no se
// acepta ese campo del cliente.
export const actualizarMiPerfil = async (req, res, next) => {
  try {
    const { nombre_usuario, nombre, apellidos, avatar_url } = req.body;

    const usuario = await Usuario.findById(req.usuario._id).select('+nombre +apellidos');

    if (nombre_usuario !== undefined && nombre_usuario !== usuario.nombre_usuario) {
      if (usuario.perfil_completo) {
        throw new ErrorHttp(400, 'El nombre de usuario no se puede cambiar una vez elegido');
      }
      usuario.nombre_usuario = nombre_usuario;
    }

    if (nombre !== undefined) usuario.nombre = nombre;
    if (apellidos !== undefined) usuario.apellidos = apellidos;
    if (avatar_url !== undefined) usuario.avatar_url = avatar_url;

    // Lo que hace falta para poder publicar. La foto entra en la lista
    // porque una cara (o algo) junto a un nombre hace la conversacion mas
    // civilizada que una fila de iniciales anonimas.
    const completo = Boolean(
      usuario.nombre_usuario &&
        usuario.nombre &&
        usuario.nombre.trim() &&
        usuario.apellidos &&
        usuario.apellidos.trim() &&
        usuario.avatar_url,
    );
    usuario.perfil_completo = completo;

    try {
      await usuario.save();
    } catch (error) {
      if (error.code === 11000) {
        throw new ErrorHttp(409, 'Ese nombre de usuario ya esta cogido');
      }
      throw error;
    }

    res.json({
      ok: true,
      usuario: { ...usuario.toJSON(), nombre: usuario.nombre, apellidos: usuario.apellidos },
    });
  } catch (error) {
    next(error);
  }
};

// La ficha publica de un vecino: lo que ve cualquiera, mas la relacion que
// tiene con quien pregunta si hay sesion.
//
// Devuelve solo CAMPOS_PUBLICOS_USUARIO mas la fecha de alta y el rol. El
// nombre real, los apellidos y el correo no salen de aqui jamas: ese es
// justo el motivo de que miPerfil() sea el unico sitio que los re-anade a
// mano.
// Marca o desmarca una cuenta como oficial. Solo admin (lo exige la ruta).
// Va aparte de actualizarMiPerfil a proposito: nadie puede declararse
// oficial a si mismo.
export const marcarOficial = async (req, res, next) => {
  try {
    if (typeof req.body?.oficial !== 'boolean') {
      throw new ErrorHttp(400, 'oficial debe ser true o false');
    }
    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      { oficial: req.body.oficial },
      { new: true, runValidators: true },
    ).select(`${CAMPOS_PUBLICOS_USUARIO} rol`);
    if (!usuario) throw new ErrorHttp(404, 'Usuario no encontrado');

    res.json({ ok: true, usuario });
  } catch (error) {
    next(error);
  }
};

// RGPD, derecho de acceso y portabilidad: todo lo que MiLepe guarda de esta
// persona, en un JSON que se descarga.
export const exportarMisDatos = async (req, res, next) => {
  try {
    const datos = await exportarDatos(req.usuario._id);
    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="milepe-mis-datos-${fecha}.json"`);
    res.json(datos);
  } catch (error) {
    next(error);
  }
};

// RGPD, derecho de supresion. Pide confirmar con la contraseña (o, en una
// cuenta de Google, escribiendo ELIMINAR): un token robado no debe bastar
// para borrar la cuenta de nadie, y un clic suelto tampoco.
export const eliminarMiCuenta = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id).select('+contraseña');

    if (usuario.contraseña) {
      const { contraseña } = req.body || {};
      if (!contraseña || !(await usuario.compararContraseña(contraseña))) {
        throw new ErrorHttp(403, 'La contraseña no es correcta');
      }
    } else if (req.body?.confirmacion !== 'ELIMINAR') {
      throw new ErrorHttp(400, 'Escribe ELIMINAR para confirmar');
    }

    // Sin admin no hay quien gestione nada: el ultimo no puede irse sin
    // nombrar antes a otro.
    if (usuario.rol === 'admin' && (await Usuario.countDocuments({ rol: 'admin', activo: true })) <= 1) {
      throw new ErrorHttp(409, 'Eres el único administrador: nombra a otro antes de eliminar tu cuenta');
    }

    const resumen = await eliminarCuenta(usuario._id);
    res.json({ ok: true, eliminado: resumen });
  } catch (error) {
    next(error);
  }
};

export const perfilPublico = async (req, res, next) => {
  try {
    const usuario = await Usuario.findOne({ _id: req.params.id, activo: true }).select(
      `${CAMPOS_PUBLICOS_USUARIO} rol fecha_creacion`,
    );

    if (!usuario) {
      throw new ErrorHttp(404, 'Usuario no encontrado');
    }

    const [seguidores, siguiendo, publicaciones] = await Promise.all([
      Seguimiento.countDocuments({ seguido_id: usuario._id }),
      Seguimiento.countDocuments({ seguidor_id: usuario._id }),
      Post.countDocuments({ autor_id: usuario._id, estado_moderacion: 'publicado' }),
    ]);

    // Sin sesion no hay relacion que contar, y la ficha se sigue viendo:
    // MiLepe se lee sin cuenta.
    let relacion = null;
    if (req.usuario) {
      const estado = await Seguimiento.estadoEntre(req.usuario._id, usuario._id);
      const bloqueado = Boolean(await Bloqueo.existeEntre(req.usuario._id, usuario._id));
      relacion = { ...estado, bloqueado, puede_escribir: estado.mutuo && !bloqueado };
    }

    res.json({ ok: true, usuario, contadores: { seguidores, siguiendo, publicaciones }, relacion });
  } catch (error) {
    next(error);
  }
};
