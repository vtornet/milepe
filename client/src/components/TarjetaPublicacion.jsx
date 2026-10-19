import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import Icono from './Icono.jsx';
import BotonReportar from './BotonReportar.jsx';
import PanelInteraccion from './PanelInteraccion.jsx';
import { haceCuanto, fechaCompleta } from '../utils/fechas.js';

// Armazón común de una publicación: avatar, autor, cuándo, insignias,
// título, texto, imágenes, datos propios de la sección y barra de acciones.
//
// Antes cada sección repetía esta estructura a mano (QuejaTarjeta,
// FotoTarjeta, EventoTarjeta, NegocioTarjeta, TurismoTarjeta,
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
  post,
  autor,
  seccion,
  chips,
  datos,
  acciones,
  permitirValoracion = false,
  children,
}) {
  const imagenes = post.imagenes || [];
  const quien = autor || post.autor || post.autor_id;

  return (
    <article className="pub">
      <header className="pub-cabecera">
        <Avatar usuario={quien} />

        <div className="pub-autor">
          <div className="pub-nombre">{quien?.nombre_usuario || 'Vecino de Lepe'}</div>
          <div className="pub-sub">
            <time dateTime={post.fecha_creacion} title={fechaCompleta(post.fecha_creacion)}>
              {haceCuanto(post.fecha_creacion)}
            </time>
            {seccion && (
              <>
                <span aria-hidden="true">·</span>
                <Link to={seccion.ruta}>{seccion.etiqueta}</Link>
              </>
            )}
          </div>
        </div>

        <BotonReportar contenidoTipo="post" contenidoId={post._id} compacto />
      </header>

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

      <PanelInteraccion
        postId={post._id}
        reaccionesIniciales={post.reacciones || post.reacciones_resumen}
        numComentarios={post.num_comentarios}
        permitirValoracion={permitirValoracion}
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
