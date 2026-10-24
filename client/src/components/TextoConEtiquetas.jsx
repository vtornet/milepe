import { Link } from 'react-router-dom';
import { trocearConEtiquetas } from '../utils/etiquetas.js';

// El texto de una publicación con sus #etiquetas como enlaces.
function TextoConEtiquetas({ texto }) {
  return trocearConEtiquetas(texto).map((trozo, i) =>
    trozo.etiqueta ? (
      <Link key={i} to={`/etiqueta/${encodeURIComponent(trozo.etiqueta)}`} className="etiqueta-enlace">
        {trozo.original}
      </Link>
    ) : (
      trozo.texto
    ),
  );
}

export default TextoConEtiquetas;
