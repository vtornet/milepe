import Usuario, { MINUTOS_VALIDEZ_RECUPERACION } from '../models/Usuario.js';
import { firmarToken } from '../utils/jwt.js';
import { verificarTokenGoogle, generarNombreUsuarioLibre } from '../utils/googleAuth.js';
import { enviarCorreo, correoRecuperacion, correoSinContraseña, correoVerificacion } from '../utils/correo.js';
import ErrorHttp from '../utils/ErrorHttp.js';

// Solo estos cuatro campos pueden llegar a Usuario.create: nunca
// req.body directamente. Si se pasara req.body tal cual, cualquiera podria
// registrarse mandando { rol: 'admin' } en el cuerpo de la peticion.
export const registrar = async (req, res, next) => {
  try {
    const { nombre_usuario, nombre, apellidos, email, contraseña } = req.body;

    const usuario = await Usuario.create({ nombre_usuario, nombre, apellidos, email, contraseña });

    // Se envia el correo de verificacion en el mismo paso. Si falla, la
    // cuenta queda creada igual y el vecino puede pedir otro desde la
    // aplicacion: perder el registro entero porque el proveedor de correo
    // tuvo un mal minuto seria mucho peor.
    await enviarVerificacion(usuario);

    res.status(201).json({ ok: true, token: firmarToken(usuario._id), usuario });
  } catch (error) {
    next(error);
  }
};

export const iniciarSesion = async (req, res, next) => {
  try {
    const { email, contraseña } = req.body;

    if (!email || !contraseña) {
      throw new ErrorHttp(400, 'Email y contraseña son obligatorios');
    }

    const usuario = await Usuario.findOne({ email: email.toLowerCase() }).select('+contraseña');

    // Mismo mensaje tanto si el email no existe como si la contraseña no
    // coincide (y si la cuenta esta desactivada): no le decimos a quien
    // intenta entrar cual de los tres casos es el suyo.
    //
    // La cuenta solo de Google no tiene contraseña guardada, asi que entra
    // por esta misma puerta: sin hash que comparar, el intento falla con
    // el mismo mensaje generico.
    if (!usuario || !usuario.activo || !usuario.contraseña || !(await usuario.compararContraseña(contraseña))) {
      throw new ErrorHttp(401, 'Credenciales invalidas');
    }

    const token = firmarToken(usuario._id);
    res.json({ ok: true, token, usuario });
  } catch (error) {
    next(error);
  }
};


// --- Verificacion del correo ---

// Genera el token, lo guarda hasheado y manda el enlace. Se usa al
// registrarse y cuando el vecino pide que se le reenvie.
const enviarVerificacion = async (usuario) => {
  const token = usuario.generarTokenVerificacion();
  await usuario.save({ validateBeforeSave: false });

  const baseCliente = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
  const enlace = `${baseCliente}/verificar?token=${token}`;

  try {
    await enviarCorreo({ para: usuario.email, ...correoVerificacion(usuario.nombre || usuario.nombre_usuario, enlace) });
  } catch (error) {
    console.error('[correo] No se pudo enviar la verificacion:', error.message);
  }
};

export const verificarCorreo = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new ErrorHttp(400, 'Falta el token de verificacion');
    }

    const usuario = await Usuario.porTokenVerificacion(token);

    if (!usuario) {
      throw new ErrorHttp(400, 'El enlace no es valido o ha caducado. Pide uno nuevo desde tu perfil.');
    }

    usuario.email_verificado = true;
    // De un solo uso, igual que el de recuperacion.
    usuario.token_verificacion = null;
    usuario.token_verificacion_expira = null;
    await usuario.save({ validateBeforeSave: false });

    // Se devuelve sesion: lo normal es que el enlace se abra en el movil,
    // donde quiza no haya sesion iniciada, y mandarle a escribir la
    // contraseña justo despues de confirmar el correo sobra.
    res.json({ ok: true, token: firmarToken(usuario._id), usuario });
  } catch (error) {
    next(error);
  }
};

// Reenviar. Exige sesion: solo puede pedirlo el dueño de la cuenta, asi
// que no hace falta el limite por correo que si lleva la recuperacion
// (alli el endpoint es publico y cualquiera puede escribir un correo ajeno).
export const reenviarVerificacion = async (req, res, next) => {
  try {
    if (req.usuario.email_verificado) {
      throw new ErrorHttp(400, 'Tu correo ya esta verificado');
    }

    const usuario = await Usuario.findById(req.usuario._id).select('+nombre');
    await enviarVerificacion(usuario);

    res.json({ ok: true, mensaje: 'Te hemos enviado un enlace nuevo. Revisa tu correo.' });
  } catch (error) {
    next(error);
  }
};

// --- Entrar con Google ---

// El cliente manda el ID token que le da Google; aqui se verifica contra
// las claves publicas de Google antes de creer una sola palabra de lo que
// contiene (ver utils/googleAuth.js).
//
// Tres casos, y el tercero es el que importa:
//   1. Ya hay cuenta con ese google_id -> entra.
//   2. No hay ninguna -> se crea.
//   3. Hay una cuenta con ESE MISMO EMAIL pero registrada con contraseña:
//      se enlaza, no se crea una segunda. Si no, un vecino que se registro
//      con correo y luego pulsa "Continuar con Google" acabaria con dos
//      cuentas distintas y sus publicaciones repartidas entre las dos. Es
//      seguro enlazar porque Google ya nos ha confirmado que ese correo es
//      suyo (email_verified, que googleAuth.js exige).
export const entrarConGoogle = async (req, res, next) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      throw new ErrorHttp(400, 'Falta el token de Google');
    }

    let datosGoogle;
    try {
      datosGoogle = await verificarTokenGoogle(credential);
    } catch (error) {
      // El motivo exacto se queda en los logs: a quien intenta colarse no
      // le interesa saber si fallo la firma, la caducidad o el audience.
      console.error('[auth] Token de Google rechazado:', error.message);
      throw new ErrorHttp(401, 'No se ha podido validar tu cuenta de Google');
    }

    let usuario = await Usuario.findOne({ google_id: datosGoogle.google_id });

    if (!usuario) {
      usuario = await Usuario.findOne({ email: datosGoogle.email });

      if (usuario) {
        // Caso 3: enlazar la cuenta que ya existe.
        usuario.google_id = datosGoogle.google_id;
        usuario.email_verificado = true;
        if (!usuario.avatar_url) usuario.avatar_url = datosGoogle.avatar_url;
        await usuario.save({ validateBeforeSave: false });
      } else {
        // Caso 2: cuenta nueva. Sin contraseña, y con un nombre de usuario
        // inventado a partir del correo, porque Google no da ninguno.
        usuario = await Usuario.create({
          google_id: datosGoogle.google_id,
          email: datosGoogle.email,
          nombre: datosGoogle.nombre,
          nombre_usuario: await generarNombreUsuarioLibre(Usuario, datosGoogle.email.split('@')[0]),
          avatar_url: datosGoogle.avatar_url,
          // Google ya lo ha verificado; no tiene sentido volver a pedirlo.
          email_verificado: true,
        });
      }
    }

    // Se comprueba DESPUES de resolver la cuenta, igual que en el login con
    // contraseña: una cuenta desactivada no entra por ninguna puerta.
    if (!usuario.activo) {
      throw new ErrorHttp(401, 'Credenciales invalidas');
    }

    res.json({ ok: true, token: firmarToken(usuario._id), usuario });
  } catch (error) {
    next(error);
  }
};

// --- Recuperacion de contraseña ---

// Limite simple en memoria para que este endpoint no sea una forma comoda
// de inundar el buzon de un vecino: cualquiera puede escribir el correo de
// otro y pedir recuperacion una y otra vez. Basta con recordar cuando se
// mando el ultimo a cada direccion.
//
// En memoria del proceso, como la cache de El Tiempo y por el mismo
// motivo: un solo pueblo y un solo servidor. Si algun dia hay varias
// instancias, esto tendria que pasar a Redis o a una coleccion con TTL.
const ultimaPeticion = new Map();
const SEGUNDOS_ENTRE_PETICIONES = 60;

const demasiadoPronto = (email) => {
  const anterior = ultimaPeticion.get(email);
  return Boolean(anterior) && Date.now() - anterior < SEGUNDOS_ENTRE_PETICIONES * 1000;
};

// La respuesta es SIEMPRE la misma: exista el correo o no, sea de Google o
// no, se haya enviado o se haya frenado por el limite. Si variara, este
// endpoint serviria para averiguar que vecinos tienen cuenta, que es justo
// lo que no hay que regalar.
const RESPUESTA_GENERICA = {
  ok: true,
  mensaje: 'Si ese correo tiene una cuenta en MiLepe, te hemos enviado un enlace para recuperarla.',
};

// Un fallo al enviar NO puede escaparse como error: si un correo
// desconocido responde 200 y uno real responde 500 porque el proveedor
// esta caido, ese 500 confirma que la cuenta existe. Justo la fuga que
// toda la respuesta generica intenta evitar. Se registra en el log, que es
// donde tiene que verlo quien mantiene esto.
const enviarSinDelatar = async (datos) => {
  try {
    await enviarCorreo(datos);
  } catch (error) {
    console.error(`[correo] No se pudo enviar "${datos.asunto}":`, error.message);
  }
};

export const solicitarRecuperacion = async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();

    if (!email) {
      throw new ErrorHttp(400, 'El email es obligatorio');
    }

    if (demasiadoPronto(email)) {
      res.json(RESPUESTA_GENERICA);
      return;
    }
    ultimaPeticion.set(email, Date.now());

    const usuario = await Usuario.findOne({ email, activo: true }).select('+contraseña +google_id');

    if (!usuario) {
      res.json(RESPUESTA_GENERICA);
      return;
    }

    if (!usuario.contraseña && usuario.google_id) {
      // No tiene contraseña que recuperar. Se le avisa por correo para que
      // no se quede esperando un mensaje que no va a llegar nunca.
      const aviso = correoSinContraseña(usuario.nombre);
      await enviarSinDelatar({ para: usuario.email, ...aviso });
      res.json(RESPUESTA_GENERICA);
      return;
    }

    const token = usuario.generarTokenRecuperacion();
    await usuario.save({ validateBeforeSave: false });

    // El enlace apunta al CLIENTE, no a la API: quien lo pulsa es una
    // persona con un navegador, y lo que tiene que ver es la pantalla para
    // escribir la contraseña nueva. Se usa el primer origen de CLIENT_URL
    // (que es una lista separada por comas; ver app.js).
    const baseCliente = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
    const enlace = `${baseCliente}/restablecer?token=${token}`;

    const correo = correoRecuperacion(usuario.nombre, enlace);
    await enviarSinDelatar({ para: usuario.email, ...correo });

    res.json(RESPUESTA_GENERICA);
  } catch (error) {
    next(error);
  }
};

export const restablecerContraseña = async (req, res, next) => {
  try {
    const { token, contraseña } = req.body;

    if (!token || !contraseña) {
      throw new ErrorHttp(400, 'Faltan el token o la contraseña nueva');
    }

    // Se comprueba aqui ademas de en el modelo para dar un mensaje claro:
    // el error de Mongoose por minlength llega como ValidationError y en
    // esta pantalla concreta se leeria peor.
    if (contraseña.length < 8) {
      throw new ErrorHttp(400, 'La contraseña debe tener al menos 8 caracteres');
    }

    const usuario = await Usuario.porTokenRecuperacion(token);

    if (!usuario) {
      throw new ErrorHttp(
        400,
        `El enlace no es valido o ha caducado (duran ${MINUTOS_VALIDEZ_RECUPERACION} minutos). Pide uno nuevo.`,
      );
    }

    usuario.contraseña = contraseña;
    // De un solo uso: el token se limpia en el mismo save que la contraseña
    // nueva, para que el enlace del correo no sirva una segunda vez.
    usuario.token_recuperacion = null;
    usuario.token_recuperacion_expira = null;
    await usuario.save();

    // Se devuelve sesion iniciada: quien acaba de demostrar que controla el
    // correo y ha elegido contraseña nueva no tiene por que escribirla otra
    // vez en la pantalla de acceso.
    res.json({ ok: true, token: firmarToken(usuario._id), usuario });
  } catch (error) {
    next(error);
  }
};

// protegido ya dejo el usuario en req.usuario; esto solo lo devuelve.
export const perfil = async (req, res) => {
  res.json({ ok: true, usuario: req.usuario });
};
