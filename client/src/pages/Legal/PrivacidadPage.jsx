import PaginaLegal from './PaginaLegal.jsx';

// Política de privacidad.
//
// El contenido describe lo que la aplicación hace DE VERDAD, campo por
// campo y proveedor por proveedor, no una plantilla genérica: si dijera
// algo que no se cumple, sería peor que no tenerla. Cuando se añada una
// función que trate datos nuevos (Stripe, por ejemplo), hay que actualizar
// esta página en el mismo cambio.
//
// Los datos del responsable van marcados como PENDIENTE a propósito: son
// el nombre o razón social, el NIF y el domicilio de quien responde
// legalmente, y eso no se puede inventar. El RGPD exige identificar al
// responsable, así que hay que rellenarlo antes de abrir el registro al
// público.
function PrivacidadPage() {
  return (
    <PaginaLegal titulo="Política de privacidad" actualizado="20 de octubre de 2026">
      <div className="aviso aviso-aviso">
        <span>
          <strong>Pendiente de completar.</strong> Faltan los datos identificativos del responsable (nombre o
          razón social, NIF y domicilio). Son obligatorios según el RGPD y deben rellenarse antes de abrir el
          registro al público.
        </span>
      </div>

      <h2>1. Quién trata tus datos</h2>
      <p>
        El responsable del tratamiento de los datos recogidos en MiLepe (milepe.com) es{' '}
        <strong>[PENDIENTE: nombre o razón social]</strong>, con NIF <strong>[PENDIENTE]</strong> y domicilio en{' '}
        <strong>[PENDIENTE]</strong>.
      </p>
      <p>
        Puedes escribirnos para cualquier cuestión sobre tus datos a{' '}
        <a href="mailto:privacidad@milepe.com">privacidad@milepe.com</a>.
      </p>

      <h2>2. Qué datos recogemos y por qué</h2>

      <h3>Cuenta</h3>
      <p>
        Al registrarte guardamos tu <strong>nombre de usuario</strong>, tu <strong>nombre</strong>, tu{' '}
        <strong>correo electrónico</strong> y tu <strong>contraseña</strong>. La contraseña no se guarda tal
        cual: se almacena cifrada con bcrypt, de forma que ni nosotros podemos leerla. Por eso, si la olvidas,
        no te la podemos decir: solo puedes cambiarla por otra.
      </p>
      <p>
        Si entras con Google, no recibimos tu contraseña de Google en ningún momento. Guardamos el
        identificador que Google nos da de tu cuenta, tu correo, tu nombre y tu foto de perfil.
      </p>
      <p>
        <strong>Base legal:</strong> la ejecución del servicio que nos pides al registrarte.
      </p>

      <h3>Lo que publicas</h3>
      <p>
        Tus publicaciones, comentarios, reacciones y valoraciones son <strong>públicos</strong>: cualquiera
        puede leerlos, también quien no tenga cuenta. Tenlo en cuenta antes de escribir algo que no quieras que
        vea todo el pueblo.
      </p>
      <p>
        En las secciones de Quejas, Negocios, Eventos y Turismo puedes añadir una <strong>ubicación</strong> en
        el mapa. Esa ubicación es la del asunto del que hablas (una farola rota, un bar, un evento), no la tuya,
        y también es pública. Si usas el buscador «cerca de mí», tu navegador te pedirá permiso para conocer tu
        posición: esa posición se usa solo para ordenar los resultados en ese momento y{' '}
        <strong>no se guarda</strong>.
      </p>

      <h3>Mensajes privados</h3>
      <p>
        Los mensajes privados solo son accesibles para las dos personas de la conversación. No están cifrados de
        extremo a extremo: quien administre el sistema podría leerlos técnicamente, y se entregarían a una
        autoridad que los reclamase legalmente. No los usamos para ninguna otra cosa.
      </p>

      <h3>Imágenes</h3>
      <p>
        Las fotos que subes se guardan en Cloudinary. Si la imagen conserva datos EXIF (por ejemplo, el lugar
        exacto donde se tomó), esos datos viajan con ella. Revisa tus fotos antes de subirlas.
      </p>

      <h3>Moderación</h3>
      <p>
        Si reportas contenido guardamos quién reportó qué y por qué. Si un moderador actúa sobre algo tuyo,
        queda registrado en un historial de auditoría: qué se hizo, cuándo y con qué motivo. Ese historial
        existe para poder revisar las decisiones y resolver tus apelaciones con criterio.
      </p>
      <p>
        <strong>Base legal:</strong> nuestro interés legítimo en mantener la convivencia y cumplir la ley.
      </p>

      <h3>Datos técnicos</h3>
      <p>
        Nuestro servidor registra las peticiones que recibe, incluida la dirección IP, para detectar fallos y
        abusos. En tu navegador guardamos tu sesión y tu preferencia de modo claro u oscuro en el
        almacenamiento local del propio navegador. <strong>No usamos cookies de analítica ni de publicidad</strong>,
        ni compartimos datos con redes publicitarias.
      </p>

      <h2>3. Con quién compartimos datos</h2>
      <p>Para funcionar, MiLepe se apoya en estos proveedores, que tratan datos por cuenta nuestra:</p>
      <ul>
        <li>
          <strong>Netlify</strong> — sirve la página web.
        </li>
        <li>
          <strong>Railway</strong> — ejecuta el servidor y aloja la base de datos (servidores en la Unión
          Europea).
        </li>
        <li>
          <strong>Cloudinary</strong> — almacena las imágenes que subes.
        </li>
        <li>
          <strong>Resend</strong> — envía los correos de recuperación de contraseña.
        </li>
        <li>
          <strong>Google</strong> — solo si decides entrar con tu cuenta de Google. El botón de Google únicamente
          se carga en las pantallas de acceso y registro; si no pasas por ellas, tu navegador no contacta con
          Google por nuestra causa.
        </li>
      </ul>
      <p>
        La sección El Tiempo consulta la previsión de OpenWeather <em>desde nuestro servidor</em>, no desde tu
        navegador, y siempre para las coordenadas fijas de Lepe. OpenWeather no recibe ningún dato tuyo.
      </p>
      <p>
        Algunos de estos proveedores son estadounidenses y pueden tratar datos fuera de la UE, amparados en las
        cláusulas contractuales tipo de la Comisión Europea. No vendemos tus datos a nadie, ni los cedemos para
        fines ajenos a MiLepe.
      </p>

      <h2>4. Cuánto tiempo los guardamos</h2>
      <p>
        Mientras tengas la cuenta abierta. Si la cierras, eliminamos tus datos personales, con dos excepciones
        que conviene que conozcas:
      </p>
      <ul>
        <li>
          El contenido que un moderador haya retirado no se borra de la base de datos: se marca como eliminado y
          deja de verse. Esto permite revisar la decisión si la apelas.
        </li>
        <li>
          El historial de moderación es un registro de auditoría y no se modifica ni se borra, porque un
          historial que se puede reescribir no sirve para auditar nada.
        </li>
      </ul>
      <p>
        En ambos casos puedes pedirnos la supresión y la valoraremos: el interés legítimo tiene límites y tu
        derecho puede pesar más.
      </p>

      <h2>5. Tus derechos</h2>
      <p>
        Puedes pedirnos <strong>acceder</strong> a tus datos, <strong>rectificarlos</strong>,{' '}
        <strong>suprimirlos</strong>, <strong>limitar</strong> u <strong>oponerte</strong> a su tratamiento y
        solicitar su <strong>portabilidad</strong>. Escríbenos a{' '}
        <a href="mailto:privacidad@milepe.com">privacidad@milepe.com</a> y te responderemos en el plazo máximo de
        un mes.
      </p>
      <p>
        Si crees que no hemos atendido bien tu petición, puedes reclamar ante la Agencia Española de Protección
        de Datos (<a href="https://www.aepd.es" target="_blank" rel="noreferrer">aepd.es</a>).
      </p>

      <h2>6. Menores</h2>
      <p>
        MiLepe no está dirigida a menores de 14 años. Si detectamos una cuenta de un menor de esa edad sin el
        consentimiento de quien ejerza su tutela, la eliminaremos.
      </p>

      <h2>7. Seguridad</h2>
      <p>
        El tráfico va cifrado con HTTPS, las contraseñas se guardan cifradas y la base de datos no está expuesta
        a internet. Aun así, ningún sistema es infalible: si ocurriera una brecha que afectase a tus datos, te lo
        comunicaríamos y lo notificaríamos a la autoridad como exige la ley.
      </p>

      <h2>8. Cambios</h2>
      <p>
        Si cambiamos esta política, actualizaremos la fecha del encabezado. Si el cambio es importante, te
        avisaremos dentro de la propia aplicación.
      </p>
    </PaginaLegal>
  );
}

export default PrivacidadPage;
