import PaginaLegal from './PaginaLegal.jsx';

// Política de privacidad.
//
// El contenido describe lo que la aplicación hace DE VERDAD, campo por
// campo y proveedor por proveedor, no una plantilla genérica: si dijera
// algo que no se cumple, sería peor que no tenerla. Cuando se añada una
// función que trate datos nuevos (Stripe, Sentry...), hay que actualizar
// esta página en el mismo cambio.
//
// El responsable va identificado con nombre y NIF. Como domicilio consta
// solo el municipio, por decisión expresa del titular: la LSSI pide la
// dirección completa de quien presta el servicio, así que esto es una
// concesión consciente, no un descuido. Si algún día se activan los pagos
// (Stripe), la actividad pasa a ser claramente comercial y la dirección
// completa deja de ser opcional.
function PrivacidadPage() {
  return (
    <PaginaLegal titulo="Política de privacidad" actualizado="24 de octubre de 2026">
      <h2>1. Quién trata tus datos</h2>
      <p>
        El responsable del tratamiento de los datos recogidos en MiLepe (milepe.com) es{' '}
        <strong>Víctor José Tornet García</strong>, con NIF <strong>77534989B</strong>, en Lepe (Huelva, España).
      </p>
      <p>
        Puedes escribirnos para cualquier cuestión sobre tus datos a{' '}
        <a href="mailto:contact@appstracta.app">contact@appstracta.app</a>.
      </p>

      <h2>2. Qué datos recogemos y por qué</h2>

      <h3>Cuenta</h3>
      <p>
        Al registrarte guardamos tu <strong>nombre de usuario</strong>, tu <strong>correo electrónico</strong> y
        tu <strong>contraseña</strong>. La contraseña no se guarda tal cual: se almacena cifrada con bcrypt, de
        forma que ni nosotros podemos leerla. Por eso, si la olvidas, no te la podemos decir: solo puedes
        cambiarla por otra. Para comprobar que el correo es tuyo te enviamos un enlace de verificación.
      </p>
      <p>
        Para poder publicar te pedimos además tu <strong>nombre y apellidos reales</strong> y una{' '}
        <strong>foto de perfil</strong>. El nombre real <strong>no es público</strong>: no aparece en ninguna
        parte de la aplicación ni se entrega a otros vecinos; lo pedimos para que detrás de cada cuenta haya una
        persona identificable si hubiera que responder ante una denuncia. Lo que ven los demás es tu nombre de
        usuario y tu foto.
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
        Tus publicaciones, comentarios, reacciones, valoraciones y anuncios son <strong>públicos</strong>:
        cualquiera puede leerlos, también quien no tenga cuenta, y se pueden compartir con un enlace (por
        ejemplo, por WhatsApp). Tenlo en cuenta antes de escribir algo que no quieras que vea todo el pueblo.
      </p>
      <p>
        En Quejas, Negocios, Eventos y Animales puedes añadir una <strong>ubicación</strong> en el mapa. Es la
        del asunto del que hablas (una farola rota, un bar, el sitio donde se perdió un perro), no la tuya, y
        también es pública. Si usas el buscador «cerca de mí» de Negocios, tu navegador te pedirá permiso para
        conocer tu posición: se usa solo para ordenar los resultados en ese momento y{' '}
        <strong>no se guarda</strong>.
      </p>
      <p>
        En Animales puedes dejar, si quieres, un <strong>teléfono de contacto</strong>. Ese teléfono es público
        para que cualquiera pueda avisarte rápido; no lo pongas si no quieres que se vea.
      </p>

      <h3>Encuestas y eventos</h3>
      <p>
        Cuando votas en una encuesta guardamos qué has votado, solo para que no se pueda votar dos veces y para
        que puedas cambiar tu voto. <strong>Nadie más ve lo que votas</strong>: los demás solo ven el recuento.
        Igual con «Voy a ir» en los eventos: se ve cuántas personas van, no quiénes.
      </p>

      <h3>Negocios</h3>
      <p>
        Si reclamas la gestión de la ficha de un negocio, guardamos el mensaje que escribes para acreditarlo. Solo
        lo leen los administradores.
      </p>

      <h3>Mensajes privados</h3>
      <p>
        Los mensajes privados solo son accesibles para las dos personas de la conversación. No están cifrados de
        extremo a extremo: quien administre el sistema podría leerlos técnicamente, y se entregarían a una
        autoridad que los reclamase legalmente. No los usamos para ninguna otra cosa. Si reportas un mensaje, el
        equipo de moderación ve <strong>solo ese mensaje</strong>, no el resto de la conversación.
      </p>

      <h3>Imágenes</h3>
      <p>
        Antes de subir una foto, la reducimos y la volvemos a guardar <strong>en tu propio navegador</strong>.
        Eso elimina sus metadatos (por ejemplo, el lugar exacto donde se tomó o el modelo del móvil), salvo en las
        imágenes GIF, que se suben tal cual. Las fotos se guardan en Cloudinary.
      </p>

      <h3>Avisos en el móvil</h3>
      <p>
        Si activas los avisos en tu perfil, guardamos la dirección técnica que tu navegador nos da para poder
        enviarte notificaciones (nuevos seguidores, mensajes). Esos avisos pasan por el servicio de
        notificaciones de tu navegador (Google, Mozilla o Apple) cifrados. Puedes desactivarlos cuando quieras.
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
        abusos, y cuenta durante unos minutos cuántas peticiones llegan desde cada IP para frenar ataques. En tu
        navegador guardamos tu sesión y tu preferencia de modo claro u oscuro en el almacenamiento local del
        propio navegador. <strong>No usamos cookies de analítica ni de publicidad</strong>, ni compartimos datos
        con redes publicitarias.
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
          <strong>Cloudinary</strong> — almacena las imágenes que subes y las copias de seguridad de la base de
          datos (en privado, no accesibles desde internet).
        </li>
        <li>
          <strong>Stripe</strong> — solo si pagas por destacar un negocio o patrocinar un evento: cobra el pago y
          recibe tu correo para enviarte el recibo. Los datos de tu tarjeta los trata Stripe directamente; a
          nosotros solo nos llega si el pago se completó. Guardamos qué compraste, cuánto y cuándo, y lo
          conservamos aunque elimines tu cuenta durante el plazo que exige la ley para los registros contables.
        </li>
        <li>
          <strong>Resend</strong> — envía los correos de verificación y de recuperación de contraseña.
        </li>
        <li>
          <strong>Google</strong> — solo si decides entrar con tu cuenta de Google. El botón de Google únicamente
          se carga en las pantallas de acceso y registro; si no pasas por ellas, tu navegador no contacta con
          Google por nuestra causa.
        </li>
        <li>
          <strong>OpenStreetMap</strong> — los mapas los dibuja tu navegador con teselas de OpenStreetMap, que,
          como cualquier web, recibe tu dirección IP al servirlas.
        </li>
      </ul>
      <p>
        El tiempo, las mareas y el índice UV los consultamos a OpenWeather y a Open-Meteo{' '}
        <em>desde nuestro servidor</em>, no desde tu navegador, y siempre para las coordenadas fijas de Lepe y
        La Antilla: esos servicios no reciben ningún dato tuyo.
      </p>
      <p>
        Algunos de estos proveedores son estadounidenses y pueden tratar datos fuera de la UE, amparados en las
        cláusulas contractuales tipo de la Comisión Europea. No vendemos tus datos a nadie, ni los cedemos para
        fines ajenos a MiLepe.
      </p>

      <h2>4. Cuánto tiempo los guardamos</h2>
      <p>
        Mientras tengas la cuenta abierta. <strong>Puedes eliminarla tú mismo desde tu perfil</strong>. Al
        hacerlo:
      </p>
      <ul>
        <li>
          Borramos tu nombre real, tu correo, tu foto, tu nombre de usuario y tu contraseña, y la cuenta queda
          como «vecino eliminado», sin posibilidad de entrar.
        </li>
        <li>
          Retiramos tus publicaciones y comentarios (los comentarios quedan como un hueco, sin texto ni autor,
          para que las conversaciones de los demás sigan teniendo sentido) y borramos tus reacciones, votos,
          asistencias, seguimientos, bloqueos, notificaciones y fotos.
        </li>
        <li>
          Los mensajes privados que enviaste <strong>se quedan en la conversación de la otra persona</strong>,
          ya sin tu nombre: también son suyos.
        </li>
      </ul>
      <p>Hay cuatro excepciones que conviene que conozcas:</p>
      <ul>
        <li>
          El contenido que un moderador haya retirado no se borra de la base de datos: se marca como eliminado y
          deja de verse. Esto permite revisar la decisión si la apelas.
        </li>
        <li>
          El historial de moderación es un registro de auditoría y no se modifica ni se borra, porque un
          historial que se puede reescribir no sirve para auditar nada. Queda asociado a la cuenta anónima.
        </li>
        <li>
          Si eliminas la cuenta <strong>mientras está suspendida</strong>, guardamos una huella cifrada de tu
          correo (no el correo en sí) durante lo que quede de suspensión, para que no pueda usarse para registrarse
          de nuevo y saltársela. Acabado ese plazo deja de tener efecto.
        </li>
        <li>
          Hacemos una <strong>copia de seguridad diaria</strong> de la base de datos y guardamos las de los
          últimos 14 días. Tus datos pueden seguir en esas copias hasta 14 días después de eliminar la cuenta;
          pasado ese plazo desaparecen solas.
        </li>
      </ul>
      <p>
        En los dos primeros casos puedes pedirnos la supresión y la valoraremos: el interés legítimo tiene
        límites y tu derecho puede pesar más.
      </p>

      <h2>5. Tus derechos</h2>
      <p>
        Puedes pedirnos <strong>acceder</strong> a tus datos, <strong>rectificarlos</strong>,{' '}
        <strong>suprimirlos</strong>, <strong>limitar</strong> u <strong>oponerte</strong> a su tratamiento y
        solicitar su <strong>portabilidad</strong>. Desde tu perfil puedes <strong>descargar todos tus datos</strong>{' '}
        en un archivo y <strong>eliminar tu cuenta</strong> en cualquier momento. Para todo lo demás, escríbenos
        a <a href="mailto:contact@appstracta.app">contact@appstracta.app</a> y te responderemos en el plazo
        máximo de un mes.
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
        El tráfico va cifrado con HTTPS, las contraseñas se guardan cifradas, la base de datos no está expuesta a
        internet y limitamos los intentos de acceso para frenar a quien prueba contraseñas. Aun así, ningún
        sistema es infalible: si ocurriera una brecha que afectase a tus datos, te lo comunicaríamos y lo
        notificaríamos a la autoridad como exige la ley.
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
