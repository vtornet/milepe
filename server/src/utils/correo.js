import nodemailer from 'nodemailer';

// Envio de correo por SMTP, no por la API de un proveedor concreto.
// Decision deliberada: SMTP lo hablan todos (Brevo, Resend, Mailgun,
// SendGrid, Zoho...), asi que cambiar de proveedor es cambiar cuatro
// variables de entorno y no reescribir este archivo ni volver a desplegar
// con otro SDK. Para lo que MiLepe manda -un enlace de recuperacion- no
// hace falta nada de lo que aportan las APIs propias.
//
// Variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CORREO_REMITENTE.

let transporte = null;

const haySmtp = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const obtenerTransporte = () => {
  if (transporte) return transporte;

  const puerto = Number(process.env.SMTP_PORT) || 587;

  transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: puerto,
    // 465 y 2465 son TLS desde el primer byte; 587 y 2587 empiezan en
    // claro y suben a TLS con STARTTLS. Poner secure: true en un puerto de
    // STARTTLS deja la conexion colgada hasta agotar el tiempo de espera,
    // sin un error que explique por que.
    //
    // Los puertos 2465/2587 existen porque muchos hospedajes (Railway
    // entre ellos) bloquean la salida por el 587 clasico: el sintoma es un
    // "Connection timeout" que parece un fallo del proveedor de correo
    // cuando en realidad es la red de salida.
    secure: puerto === 465 || puerto === 2465,
    // Sin esto, un puerto bloqueado tarda dos minutos en rendirse y la
    // peticion del vecino se queda colgada todo ese rato.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  return transporte;
};

/**
 * Envia un correo. Devuelve true si salio y false si no habia SMTP
 * configurado.
 *
 * Sin SMTP no lanza: en desarrollo escribe el correo por consola. Asi se
 * puede probar entero el circuito de recuperacion -incluido pulsar el
 * enlace- sin dar de alta ningun proveedor. En produccion, en cambio, la
 * falta de configuracion se registra como error, porque ahi significa que
 * nadie esta recibiendo nada.
 */
export const enviarCorreo = async ({ para, asunto, texto, html }) => {
  if (!haySmtp()) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        `[correo] SMTP no configurado: el correo "${asunto}" para ${para} NO se ha enviado. ` +
          'Define SMTP_HOST, SMTP_USER y SMTP_PASS.',
      );
    } else {
      console.log(`\n[correo] (sin SMTP; se muestra aqui)\n  Para: ${para}\n  Asunto: ${asunto}\n\n${texto}\n`);
    }
    return false;
  }

  await obtenerTransporte().sendMail({
    from: process.env.CORREO_REMITENTE || 'MiLepe <no-responder@milepe.com>',
    to: para,
    subject: asunto,
    text: texto,
    html,
  });

  return true;
};

// Plantilla del correo de recuperacion. En texto Y en HTML: hay clientes
// de correo que no pintan HTML, y un correo que llega vacio en esos
// clientes es un usuario que no puede recuperar su cuenta.
export const correoRecuperacion = (nombre, enlace) => ({
  asunto: 'Recuperar tu contraseña de MiLepe',
  texto: [
    `Hola ${nombre}:`,
    '',
    'Has pedido recuperar la contraseña de tu cuenta de MiLepe. Abre este enlace para elegir una nueva:',
    '',
    enlace,
    '',
    'El enlace caduca en una hora y solo se puede usar una vez.',
    '',
    'Si no has sido tú, no tienes que hacer nada: tu contraseña sigue igual.',
    '',
    'MiLepe · la red de los vecinos de Lepe',
  ].join('\n'),
  html: `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;color:#161b20">
      <p>Hola <strong>${nombre}</strong>:</p>
      <p>Has pedido recuperar la contraseña de tu cuenta de MiLepe. Pulsa el botón para elegir una nueva:</p>
      <p style="margin:28px 0">
        <a href="${enlace}" style="background:#0f6aa6;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">
          Elegir una contraseña nueva
        </a>
      </p>
      <p style="color:#525a64;font-size:14px">
        El enlace caduca en una hora y solo se puede usar una vez.<br>
        Si no has sido tú, no tienes que hacer nada: tu contraseña sigue igual.
      </p>
      <p style="color:#6f7883;font-size:13px;word-break:break-all">
        Si el botón no funciona, copia esta dirección en el navegador:<br>${enlace}
      </p>
      <hr style="border:none;border-top:1px solid #dbe1e7;margin:24px 0">
      <p style="color:#6f7883;font-size:12px">MiLepe · la red de los vecinos de Lepe</p>
    </div>
  `,
});

// Para quien se registro con Google y pide recuperar contraseña: no tiene
// ninguna que recuperar. Sin este aviso se quedaria esperando un correo
// que nunca va a llegar, pensando que el sistema falla.
export const correoSinContraseña = (nombre) => ({
  asunto: 'Tu cuenta de MiLepe entra con Google',
  texto: [
    `Hola ${nombre}:`,
    '',
    'Has pedido recuperar tu contraseña, pero tu cuenta de MiLepe no tiene: entras con tu cuenta de Google.',
    '',
    'Para entrar, pulsa "Continuar con Google" en la pantalla de acceso.',
    '',
    'MiLepe · la red de los vecinos de Lepe',
  ].join('\n'),
  html: `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;color:#161b20">
      <p>Hola <strong>${nombre}</strong>:</p>
      <p>Has pedido recuperar tu contraseña, pero tu cuenta de MiLepe no tiene: entras con tu cuenta de Google.</p>
      <p>Para entrar, pulsa <strong>«Continuar con Google»</strong> en la pantalla de acceso.</p>
      <hr style="border:none;border-top:1px solid #dbe1e7;margin:24px 0">
      <p style="color:#6f7883;font-size:12px">MiLepe · la red de los vecinos de Lepe</p>
    </div>
  `,
});

// Correo de verificacion al registrarse. Mientras no se pulse, la cuenta
// puede leer pero no publicar nada: sin esto, cualquiera se registra con
// la direccion de otro vecino y publica a su nombre.
export const correoVerificacion = (nombre, enlace) => ({
  asunto: 'Confirma tu correo en MiLepe',
  texto: [
    `Hola ${nombre}:`,
    '',
    'Gracias por darte de alta en MiLepe. Confirma que este correo es tuyo abriendo este enlace:',
    '',
    enlace,
    '',
    'Hasta que lo confirmes podras mirar MiLepe, pero no publicar ni comentar.',
    '',
    'El enlace vale 24 horas. Si no te has registrado tu, ignora este mensaje.',
    '',
    'MiLepe · la red de los vecinos de Lepe',
  ].join('\n'),
  html: `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;color:#161b20">
      <p>Hola <strong>${nombre}</strong>:</p>
      <p>Gracias por darte de alta en MiLepe. Confirma que este correo es tuyo:</p>
      <p style="margin:28px 0">
        <a href="${enlace}" style="background:#0f6aa6;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">
          Confirmar mi correo
        </a>
      </p>
      <p style="color:#525a64;font-size:14px">
        Hasta que lo confirmes podrás mirar MiLepe, pero no publicar ni comentar.<br>
        El enlace vale 24 horas. Si no te has registrado tú, ignora este mensaje.
      </p>
      <p style="color:#6f7883;font-size:13px;word-break:break-all">
        Si el botón no funciona, copia esta dirección en el navegador:<br>${enlace}
      </p>
      <hr style="border:none;border-top:1px solid #dbe1e7;margin:24px 0">
      <p style="color:#6f7883;font-size:12px">MiLepe · la red de los vecinos de Lepe</p>
    </div>
  `,
});
