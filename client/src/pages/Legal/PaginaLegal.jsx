import { Link } from 'react-router-dom';

// Armazón de las páginas legales. Vive aparte porque hay dos (privacidad y
// condiciones) con la misma forma, y porque estas páginas se leen de otra
// manera que el resto de la aplicación: texto largo y seguido, columna más
// estrecha para que la línea no se haga interminable, y los enlaces entre
// ambas siempre a mano.
function PaginaLegal({ titulo, actualizado, children }) {
  return (
    <section className="legal">
      <div className="cabecera-pagina">
        <div className="cabecera-pagina-texto">
          <h1>{titulo}</h1>
          <p className="cabecera-pagina-sub">Última actualización: {actualizado}</p>
        </div>
      </div>

      <article className="legal-cuerpo">{children}</article>

      <nav className="legal-pie">
        <Link to="/privacidad">Política de privacidad</Link>
        <Link to="/condiciones">Condiciones de uso</Link>
        <Link to="/">Volver a MiLepe</Link>
      </nav>
    </section>
  );
}

export default PaginaLegal;
