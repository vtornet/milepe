import webpush from 'web-push';
import Suscripcion from '../models/Suscripcion.js';

// Avisos push del navegador (Web Push).
//
// Mismo criterio que utils/correo.js: sin configurar no rompe nada. Si no
// hay claves VAPID, esto no manda nada y lo dice una vez; la aplicacion
// sigue funcionando igual, solo que los avisos se ven al abrirla en vez de
// llegar solos. Un push que falla NUNCA puede tumbar la peticion que lo
// provoco: que no te llegue la notificacion de un mensaje es un fastidio;
// que el mensaje no se envie porque la notificacion fallo, un fallo.
//
// Las claves VAPID son un par: la publica viaja al navegador (va en el
// bundle del cliente, es publica por diseno) y la privada se queda aqui y
// es lo que demuestra que el aviso lo manda este servidor y no cualquiera
// con el endpoint. Se generan con `npx web-push generate-vapid-keys`.

let estado = 'sin-comprobar';

const configurar = () => {
  if (estado !== 'sin-comprobar') return estado === 'listo';

  const publica = process.env.VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  // El "sujeto" tiene que ser un mailto: o una URL; es a quien avisa el
  // servicio de push si algo va mal con nuestros envios.
  const sujeto = process.env.VAPID_SUBJECT || 'mailto:contact@appstracta.app';

  if (!publica || !privada) {
    estado = 'sin-claves';
    const aviso = '[push] Sin VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY: no se enviaran avisos push.';
    if (process.env.NODE_ENV === 'production') console.error(aviso);
    else console.log(aviso);
    return false;
  }

  webpush.setVapidDetails(sujeto, publica, privada);
  estado = 'listo';
  return true;
};

const cargaDe = ({ titulo, cuerpo, ruta, etiqueta }) =>
  JSON.stringify({
    titulo,
    cuerpo,
    ruta,
    // Dos avisos con la misma etiqueta se sustituyen en lugar de
    // apilarse: veinte mensajes de la misma conversacion son un aviso,
    // no veinte. Mismo motivo que notificarMensajeNuevo.
    etiqueta: etiqueta || ruta,
  });

const enviarA = async (suscripciones, carga) => {
  const enviados = await Promise.all(
    suscripciones.map(async (suscripcion) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: suscripcion.endpoint,
            keys: { p256dh: suscripcion.claves.p256dh, auth: suscripcion.claves.auth },
          },
          carga,
        );
        return 1;
      } catch (error) {
        // 404/410 del servicio de push significa que esa suscripcion ya
        // no existe (desinstalaron la aplicacion, revocaron el permiso,
        // se limpiaron los datos del navegador). Se borra: si no, queda
        // intentandose en cada aviso para siempre.
        if (error.statusCode === 404 || error.statusCode === 410) {
          await Suscripcion.deleteOne({ _id: suscripcion._id });
        } else {
          console.error('[push] No se pudo enviar el aviso:', error.statusCode || error.message);
        }
        return 0;
      }
    }),
  );

  return enviados.reduce((suma, uno) => suma + uno, 0);
};

// Manda un aviso a todos los navegadores de un vecino.
//
// `ruta` es la ruta de la aplicacion que se abre al pulsar el aviso (por
// ejemplo /mensajes/<id>), no una URL completa: el service worker la
// resuelve contra su propio origen, asi que el mismo aviso vale en
// milepe.com y en localhost.
export const avisarPorPush = async ({ usuarioId, titulo, cuerpo, ruta = '/', etiqueta }) => {
  try {
    if (!configurar()) return 0;

    const suscripciones = await Suscripcion.find({ usuario_id: usuarioId });
    if (suscripciones.length === 0) return 0;

    return await enviarA(suscripciones, cargaDe({ titulo, cuerpo, ruta, etiqueta }));
  } catch (error) {
    // Incluido un fallo de la propia consulta: ver el comentario de
    // arriba, esto no puede tumbar nada.
    console.error('[push] Fallo al avisar:', error.message);
    return 0;
  }
};

// Manda un aviso a TODOS los navegadores suscritos, de todos los vecinos:
// solo para los avisos oficiales marcados como urgentes (un corte de agua
// ahora mismo, una emergencia). Se recorre por tandas para no cargar todas
// las suscripciones a la vez ni abrir miles de envios simultaneos. Mismo
// contrato: nunca lanza.
const TANDA_PUSH = 100;

export const avisarATodosPorPush = async ({ titulo, cuerpo, ruta = '/', etiqueta }) => {
  try {
    if (!configurar()) return 0;

    const carga = cargaDe({ titulo, cuerpo, ruta, etiqueta });
    let enviados = 0;
    let tanda = [];
    for await (const suscripcion of Suscripcion.find().cursor()) {
      tanda.push(suscripcion);
      if (tanda.length === TANDA_PUSH) {
        enviados += await enviarA(tanda, carga);
        tanda = [];
      }
    }
    if (tanda.length) enviados += await enviarA(tanda, carga);
    return enviados;
  } catch (error) {
    console.error('[push] Fallo al avisar a todos:', error.message);
    return 0;
  }
};

// La clave publica, para que el cliente no tenga que llevarla tambien en
// su propio .env y puedan desincronizarse. Una clave publica distinta de
// la del servidor produce suscripciones que no se pueden usar, y el error
// solo aparece al intentar enviar.
export const clavePublicaPush = () => process.env.VAPID_PUBLIC_KEY || null;
