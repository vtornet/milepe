import { useState } from 'react';
import api from '../../services/api.js';
import VistaContenido from './VistaContenido.jsx';

// Una apelación de la cola. Solo un admin la puede resolver, y nunca la de
// su propia decisión: eso lo comprueba el servidor contra el registro de
// auditoría, así que aquí puede aparecer el formulario y la petición
// responder 403. Se muestra ese mensaje tal cual en vez de esconder el
// formulario, porque el cliente no sabe quién tomó la decisión (al autor
// no se le dice, y esta cola tampoco lo trae).
function FilaApelacion({ apelacion, puedeResolver, onResuelta }) {
  const [decision, setDecision] = useState(null); // null | 'aceptada' | 'rechazada'
  const [respuesta, setRespuesta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const resuelta = apelacion.estado !== 'pendiente';

  const resolver = async (evento) => {
    evento.preventDefault();

    if (!respuesta.trim()) {
      setError('Hay que explicarle al autor por qué se acepta o se rechaza.');
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      await api.patch(`/moderacion/apelaciones/${apelacion._id}`, { estado: decision, respuesta });
      await onResuelta();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo resolver la apelación.');
      setEnviando(false);
    }
  };

  return (
    <article className="tarjeta">
      <div className="hilo-cabecera">
        <strong>Apelación de {apelacion.autor_id?.nombre_usuario || 'un vecino'}</strong>
        <span className="insignia">{apelacion.estado}</span>
      </div>

      <div className="tarjeta-meta">{new Date(apelacion.fecha_creacion).toLocaleString('es-ES')}</div>

      <p className="reporte-detalle">«{apelacion.texto}»</p>

      <VistaContenido contenidoTipo={apelacion.contenido_tipo} contenido={apelacion.contenido} />

      {resuelta && (
        <div className="tarjeta-meta">
          Resuelta por {apelacion.revisor_id?.nombre_usuario || 'un administrador'}
          {apelacion.fecha_revision && ` el ${new Date(apelacion.fecha_revision).toLocaleString('es-ES')}`}
          {apelacion.respuesta && `: ${apelacion.respuesta}`}
        </div>
      )}

      {!resuelta && !puedeResolver && (
        <p className="tarjeta-meta">Solo un administrador puede resolver una apelación.</p>
      )}

      {!resuelta && puedeResolver && (
        <>
          <div className="botones-reaccion">
            <button
              type="button"
              onClick={() => setDecision('aceptada')}
              className={decision === 'aceptada' ? 'activa' : undefined}
            >
              Darle la razón (restaurar)
            </button>
            <button
              type="button"
              onClick={() => setDecision('rechazada')}
              className={decision === 'rechazada' ? 'activa' : undefined}
            >
              Mantener la decisión
            </button>
          </div>

          {decision && (
            <form onSubmit={resolver} className="formulario-resolucion">
              <label>
                Respuesta al autor (obligatoria)
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={respuesta}
                  onChange={(evento) => setRespuesta(evento.target.value)}
                  placeholder={
                    decision === 'aceptada'
                      ? 'Por qué se le da la razón'
                      : 'Por qué se mantiene la decisión original'
                  }
                />
              </label>

              <div className="formulario-reporte-acciones">
                <button type="submit" disabled={enviando}>
                  {enviando ? 'Guardando...' : 'Confirmar'}
                </button>
                <button type="button" onClick={() => setDecision(null)}>
                  Cancelar
                </button>
              </div>

              <p className="tarjeta-meta">
                La decisión de una apelación es definitiva: el autor no puede volver a apelar lo mismo.
              </p>

              {error && <p className="mensaje-error">{error}</p>}
            </form>
          )}
        </>
      )}
    </article>
  );
}

export default FilaApelacion;
