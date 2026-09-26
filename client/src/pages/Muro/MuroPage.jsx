import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { SECCIONES } from '../../router/secciones.js';

// tipo de Post -> a que seccion enlazar desde el Muro. 'muro' no tiene
// seccion propia (es contenido general), asi que no aparece aqui.
const seccionPorTipo = Object.fromEntries(SECCIONES.filter((s) => s.tipo).map((s) => [s.tipo, s]));

function MuroPage() {
  const [posts, setPosts] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    api
      .get('/posts')
      .then(({ data }) => {
        if (!cancelado) setPosts(data.posts);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo cargar el muro. ¿Está el servidor arrancado?');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  if (cargando) return <p>Cargando el muro...</p>;
  if (error) return <p className="mensaje-error">{error}</p>;

  return (
    <section>
      <h1>Muro</h1>
      {posts.length === 0 && <p>Todavía no hay publicaciones. ¡Sé el primero!</p>}
      {posts.map((post) => {
        const seccion = seccionPorTipo[post.tipo];
        return (
          <article key={post._id} className="tarjeta">
            {seccion && (
              <Link to={seccion.ruta} className="insignia">
                {seccion.etiqueta}
              </Link>
            )}
            {post.titulo && <h2>{post.titulo}</h2>}
            <p>{post.contenido}</p>
            <div className="tarjeta-meta">
              Por {post.autor_id?.nombre_usuario || 'alguien'} ·{' '}
              {new Date(post.fecha_creacion).toLocaleString('es-ES')}
            </div>
          </article>
        );
      })}
    </section>
  );
}

export default MuroPage;
