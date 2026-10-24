import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/api.js';
import TarjetaPublicacion from '../../components/TarjetaPublicacion.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import { EncuestaDelMuro } from '../Encuestas/EncuestaTarjeta.jsx';
import { SECCION_POR_TIPO } from '../../router/secciones.js';
import { useTitulo } from '../../hooks/useTitulo.js';

// Una publicación sola: es a donde lleva un enlace compartido (/p/:id). La
// vista previa de WhatsApp la pone la edge function netlify/edge-functions/seo.js.
function PublicacionPage() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [noExiste, setNoExiste] = useState(false);
  useTitulo(post?.titulo);

  useEffect(() => {
    let cancelado = false;
    setPost(null);
    setNoExiste(false);
    api
      .get(`/posts/${id}`)
      .then(({ data }) => !cancelado && setPost(data.post))
      .catch(() => !cancelado && setNoExiste(true));
    return () => {
      cancelado = true;
    };
  }, [id]);

  if (noExiste) {
    return (
      <EstadoVacio icono="muro" titulo="Esta publicación no está disponible" accion={<Link to="/" className="btn btn-primario">Ir al Muro</Link>}>
        Puede que la haya borrado su autor o que se haya retirado.
      </EstadoVacio>
    );
  }
  if (!post) return <EsqueletoFeed cuantas={1} />;

  const seccion = SECCION_POR_TIPO[post.tipo];
  return (
    <section>
      {post.tipo === 'encuesta' ? (
        <EncuestaDelMuro id={post._id} />
      ) : (
        <TarjetaPublicacion post={post} seccion={seccion} />
      )}
      <p className="tarjeta-meta" style={{ marginTop: 'var(--e-3)' }}>
        {seccion ? <Link to={seccion.ruta}>Ver más en {seccion.etiqueta}</Link> : <Link to="/">Ver el Muro</Link>}
      </p>
    </section>
  );
}

export default PublicacionPage;
