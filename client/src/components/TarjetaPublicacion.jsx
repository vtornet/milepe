import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import Icono from './Icono.jsx';
import BotonReportar from './BotonReportar.jsx';
import BotonSeguir from './BotonSeguir.jsx';
import PanelInteraccion from './PanelInteraccion.jsx';
import EditarPublicacion from './EditarPublicacion.jsx';
import InsigniaOficial from './InsigniaOficial.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import { haceCuanto, fechaCompleta } from '../utils/fechas.js';

// Armazón común de una publicación: avatar, autor, cuándo, insignias,
// título, texto, imágenes, datos propios de la sección y barra de acciones.
//
// Antes cada sección repetía esta estructura a mano (QuejaTarjeta,
// FotoTarjeta, EventoTarjeta, NegocioTarjeta,
// EmpleoTarjeta): seis veces el mismo <article className="tarjeta"> con las
// insignias arriba, un h2, un p y las líneas de meta al final. El resultado
// era que cada una había ido quedando un poco distinta -una ponía el autor,
// otra no; una contaba comentarios, otra no- y cualquier mejora visual
// había que hacerla seis veces. Ahora cada sección aporta solo lo suyo:
// `chips` (sus etiquetas) y `datos` (sus campos propios: dirección,
// horario, jornal, fechas...).
//
// Mismo criterio que PanelInteraccion en su día: se extrae cuando el patrón
// ya está repetido y es idéntico, no antes.
function TarjetaPublicacion({
  post: postDelPadre,
  autor,
  seccion,
  chips,
  datos,
  acciones,
  permitirValoracion = false,
  // Negocios: quien es el propietario, para marcar sus respuestas a las reseñas.
  propietarioId = null,
  children,
}) {
  const { usuario } = useAuth();

  // La tarjeta se queda con la versión que pinta, para que una edición se
  // vea al momento sin que las seis páginas de sección tengan que pasar un
  // onEditado y recargar su lista.
  const [post, setPost] = useState(postDelPadre);
  const [editando, setEditando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [errorBorrado, setErrorBorrado] = useState(null);
  const [borrada, setBorrada] = useState(false);

  // Y si el padre trae otra versión (recargó la lista, cambió de filtro),
  // manda la suya: sin esto, una tarjeta que ya se ha editado una vez se
  // quedaría enseñando su copia local para siempre.
  useEffect(() => {
    setPost(postDelPadre);
  }, [postDelPadre]);

  const imagenes = post.imagenes || [];
  const quien = autor || post.autor || post.autor_id;

  // El Muro trae el autor en `autor_id`; las listas de cada sección, que
  // salen de agregaciones, lo traen en `autor`. Sin mirar los dos, en las
  // secciones nadie era "el autor" de nada y no salían ni editar ni borrar.
  const autorId = post.autor_id?._id || post.autor_id || quien?._id;
  const soyElAutor = Boolean(usuario && autorId && String(autorId) === String(usuario._id));
  const esEquipo = usuario?.rol === 'moderador' || usuario?.rol === 'admin';

  const borrar = async () => {
    setBorrando(true);
    setErrorBorrado(null);
    try {
      await api.delete(`/posts/${post._id}`);
      // La tarjeta desaparece sin que cada página de sección tenga que
      // recargar su lista.
      setBorrada(true);
    } catch (err) {
      setErrorBorrado(err.response?.data?.mensaje || 'No se pudo eliminar la publicación');
      setBorrando(false);
    }
  };

  if (borrada) return null;

  return (
    <article className="pub">
      <header className="pub-cabecera">
        <Avatar usuario={quien} />

        <div className="pub-autor">
          {/* El nombre lleva a su ficha: era el unico sitio del muro donde
              se ve quien ha escrito algo, y no se podia pulsar. */}
          <div className="pub-nombre">
            {autorId ? (
              <Link to={`/vecino/${autorId}`}>{quien?.nombre_usuario || 'Vecino de Lepe'}</Link>
            ) : (
              quien?.nombre_usuario || 'Vecino de Lepe'
            )}
            {quien?.oficial && <InsigniaOficial />}
          </div>
          <div className="pub-sub">
            <time dateTime={post.fecha_creacion} title={fechaCompleta(post.fecha_creacion)}>
              {haceCuanto(post.fecha_creacion)}
            </time>
            {/* Que algo se ha editado se dice siempre, a todo el mundo: un
                texto que cambia sin avisar debajo de los comentarios que
                responden al anterior es la forma más fácil de que una
                discusión acabe sin sentido. */}
            {post.editado && (
              <>
                <span aria-hidden="true">·</span>
                <span title={post.editado_en ? `Editado el ${fechaCompleta(post.editado_en)}` : 'Editado'}>
                  editado
                </span>
              </>
            )}
            {seccion && (
              <>
                <span aria-hidden="true">·</span>
                <Link to={seccion.ruta}>{seccion.etiqueta}</Link>
              </>
            )}
          </div>
        </div>

        {/* Seguir al autor desde el propio muro, que es donde se le
            descubre. El componente se esconde solo si es tu publicacion o
            si no hay sesion. */}
        <BotonSeguir usuarioId={autorId} compacto />

        {soyElAutor && !editando && (
          <button
            type="button"
            className="boton-reportar-compacto"
            title="Editar la publicación"
            onClick={() => setEditando(true)}
          >
            <Icono nombre="lapiz" tam={15} />
          </button>
        )}

        {(soyElAutor || esEquipo) && !editando && (
          <button
            type="button"
            className="boton-reportar-compacto"
            title="Eliminar la publicación"
            onClick={() => setConfirmandoBorrado(true)}
          >
            <Icono nombre="papelera" tam={15} />
          </button>
        )}

        <BotonReportar contenidoTipo="post" contenidoId={post._id} compacto />
      </header>

      {/* Preguntar aquí mismo, no con un confirm() del navegador: ese
          bloquea la página y se lee como un error del sistema. */}
      {confirmandoBorrado && (
        <div className="pub-cuerpo">
          <div className="aviso aviso-info">
            <Icono nombre="papelera" tam={18} />
            <span>
              {soyElAutor
                ? '¿Seguro que quieres eliminar tu publicación?'
                : 'Vas a eliminar la publicación de otro vecino. Quedará en el registro de moderación y se le avisará.'}
            </span>
            <button type="button" className="reaccion-compacta" onClick={borrar} disabled={borrando}>
              {borrando ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button
              type="button"
              className="reaccion-compacta"
              onClick={() => setConfirmandoBorrado(false)}
              disabled={borrando}
            >
              No
            </button>
          </div>
          {errorBorrado && <p className="error">{errorBorrado}</p>}
        </div>
      )}

      {/* Que está en la cola de revisión solo lo ven su autor y el equipo.
          Para el resto del pueblo no es información: la publicación se ve
          igual, y un cartel de "pendiente de revisar" en algo que no tiene
          nada de malo solo levanta una sospecha que nadie ha formulado. */}
      {post.revision_pendiente && (soyElAutor || esEquipo) && (
        <div className="pub-cuerpo">
          <div className="aviso aviso-info">
            <Icono nombre="reloj" tam={18} />
            <span>
              {soyElAutor
                ? 'Un moderador revisará las fotos que has cambiado. Tu publicación sigue visible mientras tanto.'
                : 'El autor cambió las fotos: pendiente de revisar.'}
            </span>
          </div>
        </div>
      )}

      {editando ? (
        <div className="pub-cuerpo">
          <EditarPublicacion
            post={post}
            onGuardado={(actualizado) => {
              setPost({ ...post, ...actualizado });
              setEditando(false);
            }}
            onCancelar={() => setEditando(false)}
          />
        </div>
      ) : (
        <>
          <div className="pub-cuerpo">
            {chips && <div className="pub-chips">{chips}</div>}

            {post.titulo && <h2 className="pub-titulo">{post.titulo}</h2>}
            {post.contenido && <p className="pub-texto">{post.contenido}</p>}

            {datos && <div className="pub-datos">{datos}</div>}

            {children}
          </div>

          {imagenes.length > 0 && (
            // La clase lleva el número de imágenes para que el CSS decida la
            // rejilla: una a todo el ancho, varias en dos columnas. Se topa en
            // cuatro porque a partir de ahí la cuadrícula se vuelve un mosaico
            // ilegible; las demás siguen ahí, solo que no se amontonan.
            <div className={`pub-medios pub-medios-${Math.min(imagenes.length, 4)}`}>
              {imagenes.slice(0, 4).map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={post.titulo || 'Imagen de la publicación'} loading="lazy" />
                </a>
              ))}
            </div>
          )}

          {acciones && <div className="acciones">{acciones}</div>}
        </>
      )}

      <PanelInteraccion
        postId={post._id}
        reaccionesIniciales={post.reacciones || post.reacciones_resumen}
        numComentarios={post.num_comentarios}
        permitirValoracion={permitirValoracion}
        propietarioId={propietarioId}
      />
    </article>
  );
}

// Un dato de sección con su icono. Se exporta desde aquí para que las seis
// secciones no inventen cada una su forma de pintar "📍 dirección".
export function Dato({ icono, children }) {
  if (!children) return null;

  return (
    <div className="pub-dato">
      <Icono nombre={icono} tam={16} />
      <span>{children}</span>
    </div>
  );
}

export default TarjetaPublicacion;
