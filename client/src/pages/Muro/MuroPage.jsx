import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { SECCIONES, SECCION_POR_TIPO } from '../../router/secciones.js';
import { useAuth } from '../../context/AuthContext.jsx';
import TarjetaPublicacion from '../../components/TarjetaPublicacion.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import Avatar from '../../components/Avatar.jsx';
import Icono from '../../components/Icono.jsx';

// Las cuatro secciones donde un vecino publica contenido propio con más
// frecuencia. El Muro agrega todas las secciones pero no tiene formulario
// propio (no existe un POST /api/posts genérico: cada tipo se crea en su
// sección, con su *_detalle), así que esta fila hace de punto de partida y
// lleva a la sección que corresponda.
const PARA_PUBLICAR = ['/quejas', '/fotos', '/eventos', '/negocios'];

function MuroPage() {
  const { usuario } = useAuth();
  const [posts, setPosts] = useState(null);
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
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const atajos = SECCIONES.filter((s) => PARA_PUBLICAR.includes(s.ruta));

  return (
    <>
      <div className="cabecera-pagina">
        <div className="cabecera-pagina-texto">
          <h1>Muro</h1>
          <p className="cabecera-pagina-sub">Todo lo que pasa en Lepe, de todas las secciones</p>
        </div>
      </div>

      {/* Caja de "¿qué quieres contar?". No publica directamente -no hay un
          endpoint genérico de post- pero da el punto de entrada que una red
          social tiene siempre arriba del feed, en vez de obligar a buscar
          la sección en el menú. */}
      <div className="compositor">
        <Avatar usuario={usuario} />
        <div className="compositor-cuerpo">
          <p className="compositor-pregunta">
            {usuario ? `¿Qué quieres contar, ${usuario.nombre_usuario}?` : '¿Tienes algo que contar en Lepe?'}
          </p>
          <div className="compositor-atajos">
            {atajos.map((seccion) => (
              <Link key={seccion.ruta} to={seccion.ruta} className="btn btn-plano btn-sm">
                <Icono nombre={seccion.icono} tam={17} />
                {seccion.etiqueta}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="aviso aviso-error">
          <Icono nombre="alerta" tam={18} />
          <span>{error}</span>
        </div>
      )}

      {!error && posts === null && <EsqueletoFeed cuantas={3} />}

      {posts?.length === 0 && (
        <EstadoVacio
          icono="muro"
          titulo="El muro está vacío"
          accion={
            <Link to="/quejas" className="btn btn-primario">
              Publicar lo primero
            </Link>
          }
        >
          Aquí van apareciendo las publicaciones de todas las secciones. Todavía no hay ninguna: sé el primero.
        </EstadoVacio>
      )}

      {posts?.map((post) => (
        <TarjetaPublicacion key={post._id} post={post} seccion={SECCION_POR_TIPO[post.tipo]} />
      ))}
    </>
  );
}

export default MuroPage;
