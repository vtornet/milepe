import { useState } from 'react';
import api from '../../services/api.js';

// Notas del equipo sobre un contenido. Solo las ve el equipo, no llegan
// nunca al autor, y no se editan ni se borran (el servidor lo impide): son
// el contexto que necesita quien venga después.
function NotasInternas({ contenidoTipo, contenidoId }) {
  const [abiertas, setAbiertas] = useState(false);
  const [notas, setNotas] = useState(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const abrir = async () => {
    setAbiertas(!abiertas);
    if (notas || abiertas) return;
    try {
      const { data } = await api.get('/moderacion/notas', { params: { contenido_tipo: contenidoTipo, contenido_id: contenidoId } });
      setNotas(data.notas);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudieron cargar las notas.');
    }
  };

  const anadir = async (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setError(null);
    setEnviando(true);
    try {
      const { data } = await api.post('/moderacion/notas', { contenido_tipo: contenidoTipo, contenido_id: contenidoId, texto });
      setNotas((actuales) => [...(actuales || []), data.nota]);
      setTexto('');
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo guardar la nota.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="notas-internas">
      <button type="button" className="btn btn-plano btn-sm" onClick={abrir} aria-expanded={abiertas}>
        {abiertas ? 'Ocultar notas internas' : `Notas internas${notas ? ` (${notas.length})` : ''}`}
      </button>

      {abiertas && (
        <>
          {notas?.length === 0 && <p className="tarjeta-meta">Nadie ha dejado notas sobre esto.</p>}
          {notas?.map((n) => (
            <p key={n._id} className="tarjeta-meta">
              <strong>{n.autor_id?.nombre_usuario || 'alguien'}</strong> · {new Date(n.fecha_creacion).toLocaleString('es-ES')}:{' '}
              {n.texto}
            </p>
          ))}
          <form onSubmit={anadir} className="fila" style={{ gap: 'var(--e-2)' }}>
            <label className="solo-lectores" htmlFor={`nota-${contenidoId}`}>
              Nueva nota interna
            </label>
            <input
              id={`nota-${contenidoId}`}
              value={texto}
              maxLength={1000}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Solo la ve el equipo; no se puede borrar"
            />
            <button type="submit" className="btn btn-contorno btn-sm" disabled={enviando || !texto.trim()}>
              Añadir
            </button>
          </form>
        </>
      )}
      {error && <p className="mensaje-error">{error}</p>}
    </div>
  );
}

export default NotasInternas;
