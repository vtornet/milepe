import { Link } from 'react-router-dom';
import PaginaLegal from './PaginaLegal.jsx';

// Condiciones de uso.
//
// Igual que la política de privacidad: describe cómo funciona MiLepe de
// verdad (moderación con umbral de reportes, apelación ante un
// administrador distinto, borrado lógico), no una plantilla. Si se cambia
// el funcionamiento de la moderación, hay que cambiar también este texto.
function CondicionesPage() {
  return (
    <PaginaLegal titulo="Condiciones de uso" actualizado="24 de octubre de 2026">
      <h2>1. Qué es MiLepe</h2>
      <p>
        MiLepe es una red social para los vecinos de Lepe (Huelva): un sitio donde avisar al Ayuntamiento de lo
        que hay que arreglar, compartir fotos del pueblo, anunciar eventos, dar de alta negocios locales,
        publicar ofertas y búsquedas de empleo, poner anuncios en el tablón, ayudar con animales perdidos o en adopción, votar encuestas y hablar entre vecinos.
      </p>
      <p>
        El titular del servicio es <strong>Víctor José Tornet García</strong>, NIF <strong>77534989B</strong>,
        en Lepe (Huelva, España). Puedes contactar en{' '}
        <a href="mailto:contact@appstracta.app">contact@appstracta.app</a>.
      </p>
      <p>
        MiLepe <strong>no es un servicio del Ayuntamiento de Lepe</strong> ni está vinculada a él. Publicar una
        queja aquí no equivale a presentar una reclamación oficial: para eso, dirígete al Ayuntamiento por sus
        cauces.
      </p>

      <h2>2. Tu cuenta</h2>
      <p>
        Para publicar, comentar o enviar mensajes necesitas una cuenta. Al crearla aceptas estas condiciones y
        la <Link to="/privacidad">política de privacidad</Link>.
      </p>
      <ul>
        <li>Debes tener al menos 14 años.</li>
        <li>Los datos que des han de ser ciertos; no suplantes a otra persona, negocio o institución.</li>
        <li>Eres responsable de lo que se haga desde tu cuenta. Si crees que alguien ha entrado, cambia la contraseña y avísanos.</li>
        <li>Una persona, una cuenta.</li>
      </ul>

      <h2>3. Qué puedes publicar y qué no</h2>
      <p>Lo publicado es tuyo y eres responsable de ello. No se admite contenido que:</p>
      <ul>
        <li>insulte, acose, amenace o señale a una persona concreta;</li>
        <li>incite al odio o discrimine por origen, sexo, religión, orientación, discapacidad o cualquier otra condición;</li>
        <li>sea sexual, especialmente si implica a menores;</li>
        <li>difunda datos personales de otros (teléfonos, direcciones, matrículas) sin su permiso;</li>
        <li>sea publicidad encubierta, spam o estafa;</li>
        <li>infrinja derechos de autor: no subas fotos que no sean tuyas o sobre las que no tengas permiso;</li>
        <li>acuse a alguien de un delito sin que haya una resolución que lo respalde;</li>
        <li>sea falso y pueda causar daño, en particular sobre emergencias o salud.</li>
      </ul>
      <p>
        En la sección de Quejas, critica <strong>el problema</strong>, no a las personas. «La farola de la calle
        X lleva dos semanas fundida» es una queja; señalar con nombre y apellidos a un empleado municipal, no.
      </p>

      <h2>4. Cómo funciona la moderación</h2>
      <p>
        MiLepe se modera <em>después</em> de publicar: lo que escribes se ve al instante y solo se revisa si
        alguien lo reporta o si un moderador lo ve por su cuenta.
      </p>
      <ul>
        <li>
          Cualquier vecino puede reportar una publicación o un comentario indicando un motivo. No se puede
          reportar lo mismo dos veces.
        </li>
        <li>
          Cuando algo acumula <strong>tres reportes pendientes</strong>, se oculta automáticamente mientras un
          moderador lo revisa. Que se oculte no significa que se haya decidido nada: si el moderador descarta
          los reportes, vuelve a publicarse.
        </li>
        <li>
          Un moderador puede ocultar o retirar contenido. Siempre queda constancia de quién lo hizo, cuándo y
          por qué, y te avisamos con el motivo.
        </li>
      </ul>

      <h2>5. Tu derecho a apelar</h2>
      <p>
        Si retiramos algo tuyo, puedes verlo en <strong>«Mi contenido»</strong> y presentar una apelación
        explicando por qué crees que la decisión es equivocada.
      </p>
      <ul>
        <li>La resuelve un administrador, y <strong>nunca la misma persona que tomó la decisión</strong>.</li>
        <li>Recibirás siempre una respuesta escrita, se te dé o no la razón.</li>
        <li>Si se acepta, tu contenido vuelve a publicarse.</li>
        <li>Se puede apelar una vez por publicación: la resolución es definitiva.</li>
      </ul>

      <h2>6. Qué derechos nos cedes sobre lo que publicas</h2>
      <p>
        Lo que publicas sigue siendo tuyo. Al publicarlo en MiLepe nos autorizas únicamente a almacenarlo y
        mostrarlo dentro de MiLepe para que la aplicación funcione. No lo vendemos, no lo cedemos a terceros ni
        lo usamos en publicidad. Si borras tu cuenta, dejamos de mostrarlo con las excepciones que explica la{' '}
        <Link to="/privacidad">política de privacidad</Link>.
      </p>

      <h2>7. Negocios y empleo</h2>
      <p>
        Las fichas de negocios y las ofertas de empleo las publican los propios vecinos. MiLepe{' '}
        <strong>no verifica</strong> que un negocio exista, que una oferta sea real ni que las condiciones de
        trabajo que anuncia sean legales. Desconfía de quien pida dinero por adelantado para darte un empleo, y
        repórtalo.
      </p>
      <p>
        <strong>Servicios de pago.</strong> Quien gestiona la ficha de un negocio puede destacarla 30 días
        (9,90 €), y quien publica un evento puede patrocinarlo hasta su fecha, con un máximo de 30 días
        (4,90 €). Los precios incluyen el IVA. El pago es único, no una suscripción: no se renueva solo, y si
        vuelves a pagar mientras sigue vigente, los días se suman a los que te quedan. El cobro lo gestiona{' '}
        <strong>Stripe</strong>; MiLepe no ve ni guarda los datos de tu tarjeta. Destacar o patrocinar solo
        cambia dónde aparece la publicación (primero en su sección, con una marca): no la libra de la
        moderación, y si se retira por incumplir estas condiciones no se devuelve el importe. Si el servicio
        no se presta por un fallo nuestro, te lo devolvemos. Para cualquier reclamación sobre un cobro,
        escríbenos.
      </p>
      <p>
        <strong>Perfil verificado.</strong> Cualquier vecino puede llevar la insignia de perfil verificado junto
        a su nombre con una suscripción de 1,50 € al mes (IVA incluido), que se renueva sola cada mes. Puedes darte
        de baja cuando quieras desde tu perfil: no se te vuelve a cobrar y conservas la insignia hasta el final
        del mes ya pagado. Si un cobro falla, Stripe lo reintenta durante unos días; si no se consigue, la
        suscripción termina. El equipo de MiLepe también puede conceder la insignia sin coste (por ejemplo, a
        administradores, comercios o entidades conocidas). La insignia indica que la cuenta tiene la suscripción
        al día o que la ha concedido el equipo; <strong>no es una garantía</strong> de identidad ni de lo que esa
        persona publica, y no la libra de la moderación. Si una cuenta verificada se suspende o se elimina por
        incumplir estas condiciones, no se devuelve lo pagado.
      </p>

      <h2>8. Tablón, animales y encuestas</h2>
      <p>
        Los anuncios del tablón y las publicaciones de animales los ponen los vecinos: MiLepe no interviene en
        las compraventas, regalos ni adopciones, ni comprueba lo que se anuncia. Las encuestas recogen la opinión
        de quien quiere votar y <strong>no son vinculantes</strong> ni tienen valor oficial, aunque las publique
        el Ayuntamiento.
      </p>
      <p>
        <strong>En MiLepe está prohibida la venta de animales</strong>, tanto en la sección de Animales como en el
        tablón: se admiten animales perdidos, encontrados, en adopción o que buscan casa de acogida, y
        recomendamos siempre la adopción. Las publicaciones que vendan animales, aunque lo disimulen como
        «adopción con gastos», se retiran.
      </p>

      <h2>9. Cuenta oficial y avisos</h2>
      <p>
        Las cuentas con la insignia de verificada pertenecen al Ayuntamiento de Lepe y son las únicas que pueden
        publicar avisos oficiales y responder a las quejas en su nombre. Si alguien se hace pasar por una
        institución, repórtalo.
      </p>

      <h2>10. Teléfonos de interés, farmacias y mareas</h2>
      <p>
        La sección de Contactos recoge teléfonos de utilidad. Los de emergencia nacionales (112, 062, 061) son
        fiables, pero <strong>en una emergencia llama siempre al 112</strong> y no dependas de que esta
        aplicación esté disponible o actualizada. Las farmacias de guardia se copian a mano del cuadro del
        Colegio de Farmacéuticos y las mareas son una estimación: ante la duda, llama a la farmacia y no uses
        las mareas para navegar.
      </p>

      <h2>11. Suspensión de cuentas</h2>
      <p>
        Podemos <strong>suspender</strong> una cuenta que incumpla estas condiciones de forma grave o reiterada,
        durante un tiempo (que acaba solo) o de forma indefinida. La suspensión la decide un administrador, siempre
        con un motivo, y te lo comunicamos por correo; también lo verás si intentas entrar. Mientras dure no
        podrás entrar ni participar, pero sí descargar tus datos o eliminar tu cuenta. Lo que ya publicaste se
        queda como estaba, salvo que se retire aparte por moderación. Si crees que es un error, escríbenos
        respondiendo a ese correo.
      </p>
      <p>Tú puedes dejar de usar MiLepe cuando quieras y eliminar tu cuenta desde tu perfil.</p>

      <h2>12. Responsabilidad</h2>
      <p>
        MiLepe es un proyecto vecinal que se ofrece tal cual, sin garantía de estar siempre disponible ni libre
        de fallos. No respondemos del contenido que publican los usuarios, aunque retiraremos el que sea ilícito
        en cuanto tengamos conocimiento efectivo de ello, como exige la ley. Tampoco respondemos de los tratos
        que hagas con otros vecinos a raíz de un anuncio.
      </p>

      <h2>13. Cambios y ley aplicable</h2>
      <p>
        Podemos modificar estas condiciones; actualizaremos la fecha del encabezado y, si el cambio es
        relevante, avisaremos dentro de la aplicación. Se aplica la legislación española, y para cualquier
        conflicto son competentes los juzgados que correspondan según la ley de consumidores.
      </p>
    </PaginaLegal>
  );
}

export default CondicionesPage;
