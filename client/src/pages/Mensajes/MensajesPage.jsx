import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api.js';
import Icono from '../../components/Icono.jsx';
import { useTitulo } from '../../hooks/useTitulo.js';

const formatearFecha = (iso) => new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });

// Bandeja de entrada: los hilos abiertos y un buscador de vecinos.
//
// El buscador ya no abre la conversacion directamente, porque desde que
// hace falta seguimiento mutuo eso acabaria casi siempre en un 403: lleva
// a la ficha del vecino, que es donde estan el boton de seguir y el de
// escribir, con el motivo escrito si todavia no se puede.
function MensajesPage() {
  useTitulo('Mensajes');
  const navigate = useNavigate();

  const [conversaciones, setConversaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);

  useEffect(() => {
    let cancelado = false;

    api
      .get('/conversaciones')
      .then(({ data }) => {
        if (!cancelado) setConversaciones(data.conversaciones);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudieron cargar tus conversaciones.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  // Se espera 300 ms tras la ultima tecla antes de consultar: escribir un
  // nombre son varias pulsaciones y no tiene sentido una peticion por
  // cada una.
  useEffect(() => {
    const texto = busqueda.trim();

    if (texto.length < 2) {
      setResultados([]);
      return undefined;
    }

    let cancelado = false;
    const temporizador = setTimeout(() => {
      api
        .get('/usuarios/buscar', { params: { q: texto } })
        .then(({ data }) => {
          if (!cancelado) setResultados(data.usuarios);
        })
        .catch(() => {
          if (!cancelado) setResultados([]);
        });
    }, 300);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [busqueda]);

  const irAFicha = (usuario) => navigate(`/vecino/${usuario._id}`);

  return (
    <section>
      <h1>Mensajes</h1>

      <div className="buscador-vecinos">
        <label htmlFor="buscar-vecino">Buscar un vecino</label>
        <input
          id="buscar-vecino"
          type="search"
          placeholder="Nombre o usuario (mínimo 2 letras)"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
        />

        {resultados.length > 0 && (
          <ul className="resultados-busqueda">
            {resultados.map((usuario) => (
              <li key={usuario._id}>
                <button type="button" onClick={() => irAFicha(usuario)}>
                  {usuario.nombre_usuario}
                </button>
              </li>
            ))}
          </ul>
        )}

        {busqueda.trim().length >= 2 && resultados.length === 0 && (
          <p className="tarjeta-meta">Ningún vecino coincide con «{busqueda.trim()}».</p>
        )}
      </div>

      {error && <p className="mensaje-error">{error}</p>}

      {cargando && <p>Cargando conversaciones...</p>}

      {!cargando && conversaciones.length === 0 && (
        <p>Todavía no tienes ninguna conversación. Busca a un vecino arriba para escribirle.</p>
      )}

      {conversaciones.map((conversacion) => (
        <Link key={conversacion._id} to={`/mensajes/${conversacion._id}`} className="tarjeta hilo">
          <div className="hilo-cabecera">
            <strong>{conversacion.con?.nombre_usuario || 'Vecino'}</strong>
            {conversacion.no_leidos > 0 && <span className="insignia">{conversacion.no_leidos}</span>}
            {/* Se marca en la propia bandeja y no al abrir el hilo: enterarse
                de que ya no podéis escribiros después de redactar un
                mensaje es la peor forma de enterarse. */}
            {conversacion.solo_lectura && (
              <span className="insignia" title="Para escribiros tenéis que seguiros mutuamente">
                <Icono nombre="alerta" tam={13} /> solo lectura
              </span>
            )}
          </div>

          <div className="tarjeta-meta">
            {conversacion.ultimo_mensaje
              ? `${conversacion.ultimo_mensaje.texto} · ${formatearFecha(conversacion.ultimo_mensaje.fecha)}`
              : 'Sin mensajes todavía'}
          </div>
        </Link>
      ))}
    </section>
  );
}

export default MensajesPage;
