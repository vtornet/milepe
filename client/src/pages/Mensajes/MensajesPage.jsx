import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api.js';

const formatearFecha = (iso) => new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });

// Bandeja de entrada: los hilos abiertos y un buscador para empezar uno
// nuevo. El buscador esta aqui porque todavia no hay pagina de perfil
// desde la que pulsar "escribir a X": sin el, esta pantalla estaria vacia
// y no habria manera de iniciar una conversacion.
function MensajesPage() {
  const navigate = useNavigate();

  const [conversaciones, setConversaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [abriendo, setAbriendo] = useState(false);

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

  const abrirConversacion = async (usuario) => {
    setAbriendo(true);
    setError(null);

    try {
      const { data } = await api.post(`/conversaciones/con/${usuario._id}`);
      navigate(`/mensajes/${data.conversacion._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo abrir la conversación.');
      setAbriendo(false);
    }
  };

  return (
    <section>
      <h1>Mensajes</h1>

      <div className="buscador-vecinos">
        <label htmlFor="buscar-vecino">Escribir a un vecino</label>
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
                <button type="button" disabled={abriendo} onClick={() => abrirConversacion(usuario)}>
                  {usuario.nombre_usuario}
                  {usuario.nombre && usuario.nombre !== usuario.nombre_usuario && ` · ${usuario.nombre}`}
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
