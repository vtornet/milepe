import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import TarjetaPublicacion from '../../components/TarjetaPublicacion.jsx';
import { SECCION_POR_TIPO } from '../../router/secciones.js';
import { fechaHora } from '../../utils/fechas.js';

// Una encuesta: elegir y votar, o ver el resultado. El servidor solo manda
// los votos (`votos`) a quien ya ha votado, a quien la publicó o cuando está
// cerrada, así que aquí "hay votos" es lo mismo que "se pueden enseñar".
function EncuestaTarjeta({ encuesta: inicial, conSeccion = false }) {
  const { usuario } = useAuth();
  const [encuesta, setEncuesta] = useState(inicial);
  const [eleccion, setEleccion] = useState(inicial.mi_voto ?? null);
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => setEncuesta(inicial), [inicial]);

  const votar = async (e) => {
    e.preventDefault();
    if (eleccion === null) return;
    setError(null);
    setEnviando(true);
    try {
      const { data } = await api.post(`/encuestas/${encuesta._id}/votar`, { opcion: eleccion });
      setEncuesta({ ...encuesta, ...data.encuesta });
      setCambiando(false);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo votar');
    } finally {
      setEnviando(false);
    }
  };

  const conResultados = Array.isArray(encuesta.votos) && !cambiando;
  const total = encuesta.total_votos || 0;

  return (
    <TarjetaPublicacion
      post={encuesta}
      seccion={conSeccion ? SECCION_POR_TIPO.encuesta : undefined}
      chips={
        <>
          <span className={`insignia ${encuesta.abierta ? 'insignia-info' : ''}`}>
            {encuesta.abierta ? `Abierta hasta el ${fechaHora(encuesta.cierra_en)}` : 'Cerrada'}
          </span>
          <span className="insignia">{total === 1 ? '1 voto' : `${total} votos`}</span>
        </>
      }
    >
      {conResultados ? (
        <ul className="encuesta-resultados">
          {encuesta.opciones.map((opcion, i) => {
            const n = encuesta.votos[i] || 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            return (
              <li key={opcion} className={encuesta.mi_voto === i ? 'mia' : undefined}>
                <span className="encuesta-barra" style={{ width: `${pct}%` }} />
                <span className="encuesta-texto">
                  {opcion}
                  {encuesta.mi_voto === i && ' · tu voto'}
                </span>
                <strong>{pct}%</strong>
              </li>
            );
          })}
        </ul>
      ) : (
        <form onSubmit={votar} className="encuesta-opciones">
          {encuesta.opciones.map((opcion, i) => (
            <label key={opcion}>
              <input
                type="radio"
                name={`encuesta-${encuesta._id}`}
                checked={eleccion === i}
                onChange={() => setEleccion(i)}
                disabled={!usuario || !encuesta.abierta}
                style={{ width: 'auto' }}
              />
              {opcion}
            </label>
          ))}
          {usuario ? (
            <button type="submit" className="btn btn-primario btn-sm" disabled={eleccion === null || enviando}>
              {enviando ? 'Votando…' : 'Votar'}
            </button>
          ) : (
            <p className="tarjeta-meta">Inicia sesión para votar. El voto es anónimo.</p>
          )}
        </form>
      )}

      {conResultados && encuesta.abierta && encuesta.mi_voto !== null && encuesta.mi_voto !== undefined && (
        <button type="button" className="btn btn-plano btn-sm" onClick={() => setCambiando(true)}>
          Cambiar mi voto
        </button>
      )}
      {error && <p className="mensaje-error">{error}</p>}
    </TarjetaPublicacion>
  );
}

// En el Muro llega el post a secas, sin opciones: se pide la encuesta
// completa (y, con sesión, el voto propio) al pintarla.
export function EncuestaDelMuro({ id }) {
  const [encuesta, setEncuesta] = useState(null);
  useEffect(() => {
    let cancelado = false;
    api
      .get(`/encuestas/${id}`)
      .then(({ data }) => !cancelado && setEncuesta(data.encuesta))
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [id]);
  return encuesta ? <EncuestaTarjeta encuesta={encuesta} conSeccion /> : null;
}

export default EncuestaTarjeta;
