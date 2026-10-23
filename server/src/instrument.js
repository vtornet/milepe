import * as Sentry from '@sentry/node';

// Monitorizacion de errores. Se importa la primera de todas desde server.js
// (despues de dotenv): Sentry tiene que estar iniciado antes de que se
// cargue el resto para poder recoger tambien lo que falle al arrancar.
//
// Mismo contrato que utils/correo.js y utils/push.js: sin SENTRY_DSN no se
// rompe nada, simplemente no se envia nada. El DSN sale de un proyecto de
// tipo Node.js/Express en sentry.io (Settings > Client Keys).
const dsn = (process.env.SENTRY_DSN || '').trim();

export const sentryActivo = Boolean(dsn);

// Que errores merecen un aviso. Solo los que son fallo nuestro: lo que el
// manejador de errores de app.js contesta como 4xx (validacion de Mongoose,
// duplicado, id mal formado, subida rechazada, y los ErrorHttp 404/403/400)
// es el cliente equivocandose y llenaria el panel de ruido. Hay que
// pasarlo a la vez a expressIntegration (que captura por su cuenta al
// instrumentar Express) y a setupExpressErrorHandler: con solo uno de los
// dos, el otro seguia enviando un CastError como si fuera un fallo.
export const deberiaAvisar = (error) => {
  const esperado = ['ValidationError', 'CastError', 'MulterError'].includes(error.name) || error.code === 11000;
  return !esperado && (error.status || 500) >= 500;
};

if (sentryActivo) {
  Sentry.init({
    dsn,
    integrations: [Sentry.expressIntegration({ shouldHandleError: deberiaAvisar })],
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',

    // Ni IP ni usuario: el aviso dice QUE fallo y DONDE, no quien lo vio.
    sendDefaultPii: false,
    // Los cuerpos de las peticiones llevan contrasenas, mensajes privados y
    // tokens de Google. Nada de eso debe salir de aqui.
    maxRequestBodySize: 'none',

    // Solo errores. Las trazas de rendimiento serian trafico y cuota de
    // Sentry para algo que a este tamano no hace falta.
    tracesSampleRate: 0,

    beforeSend(evento) {
      if (evento.request) {
        delete evento.request.data;
        delete evento.request.cookies;
        if (evento.request.headers) {
          delete evento.request.headers.authorization;
          delete evento.request.headers.cookie;
          // La IP del vecino va en estas cabeceras aunque sendDefaultPii
          // este apagado.
          delete evento.request.headers['x-forwarded-for'];
          delete evento.request.headers['x-real-ip'];
        }
      }
      return evento;
    },
  });
} else if (process.env.NODE_ENV === 'production') {
  console.warn('[sentry] SENTRY_DSN no esta configurada: los errores del servidor solo quedaran en los logs');
}
