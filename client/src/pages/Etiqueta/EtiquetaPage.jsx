import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/api.js';
import TarjetaPublicacion from '../../components/TarjetaPublicacion.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import Icono from '../../components/Icono.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import { EncuestaDelMuro } from '../Encuestas/EncuestaTarjeta.jsx';
import { SECCION_POR_TIPO } from '../../router/secciones.js';
import { normalizarEtiqueta } from '../../utils/etiquetas.js';
import { useTitulo } from '../../hooks/useTitulo.js';

// Todo lo publicado con una #etiqueta, de cualquier sección: el mismo feed
// del Muro con un filtro más.
function EtiquetaPage() {
  const etiqueta = normalizarEtiqueta(useParams().etiqueta.replace(/^#/, ''));
  useTitulo(`#${etiqueta}`);
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setPosts(null);
    setError(null);
    api
      .get('/posts', { params: { etiqueta, limite: 50 } })
      .then(({ data }) => !cancelado && setPosts(data.posts))
      .catch(() => !cancelado && setError('No se pudieron cargar las publicaciones.'));
    return () => {
      cancelado = true;
    };
  }, [etiqueta]);

  return (
    <section>
      <div className="cabecera-pagina">
        <span className="cabecera-pagina-icono" aria-hidden="true">
          <Icono nombre="buscar" tam={22} />
        </span>
        <div className="cabecera-pagina-texto">
          <h1>#{etiqueta}</h1>
          <p className="cabecera-pagina-sub">Publicaciones de todas las secciones con esta etiqueta.</p>
        </div>
      </div>

      {error && <p className="mensaje-error">{error}</p>}
      {!error && posts === null && <EsqueletoFeed cuantas={2} />}
      {posts?.length === 0 && (
        <EstadoVacio icono="buscar" titulo={`Nada con #${etiqueta}`} accion={<Link to="/" className="btn btn-primario">Ir al Muro</Link>}>
          Escribe #{etiqueta} en una publicación y aparecerá aquí.
        </EstadoVacio>
      )}
      {posts?.map((post) =>
        post.tipo === 'encuesta' ? (
          <EncuestaDelMuro key={post._id} id={post._id} />
        ) : (
          <TarjetaPublicacion key={post._id} post={post} seccion={SECCION_POR_TIPO[post.tipo]} />
        ),
      )}
    </section>
  );
}

export default EtiquetaPage;
