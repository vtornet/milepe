import { useState } from 'react';
import api from '../../services/api.js';
import VistaContenido from './VistaContenido.jsx';
import Asignacion from './Asignacion.jsx';
import NotasInternas from './NotasInternas.jsx';

const ETIQUETA_MOTIVO = {
  spam: 'Spam o publicidad',
  acoso: 'Acoso',
  contenido_inapropiado: 'Contenido inapropiado',
  informacion_falsa: 'Información falsa',
  discurso_odio: 'Discurso de odio',
  otro: 'Otro motivo',
};

// Una fila de la cola de reportes, con su resolución. Las dos decisiones
// (aceptar / rechazar) están separadas en dos botones en vez de un
// desplegable porque son lo único que se hace aquí y conviene que cueste
// poco; la acción sobre el contenido solo aparece al aceptar, ya que un
// reporte rechazado no puede llevarla (el servidor lo rechaza con un 400).
function FilaReporte({ reporte: inicial, onResuelto }) {
  // La asignación se cambia aquí mismo sin recargar la cola.
  const [reporte, setReporte] = useState(inicial);
  const [decision, setDecision] = useState(null); // null | 'aceptado' | 'rechazado'
  const [accion, setAccion] = useState('ocultar');
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const resuelto = reporte.estado !== 'pendiente';

  const resolver = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    try {
      await api.patch(`/moderacion/reportes/${reporte._id}`, {
        estado: decision,
        accion: decision === 'aceptado' ? accion : 'ninguna',
        nota: nota.trim() || undefined,
      });
      await onResuelto();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo resolver el reporte.');
      setEnviando(false);
    }
  };

  return (
    <article className="tarjeta">
      <div className="hilo-cabecera">
        <strong>{ETIQUETA_MOTIVO[reporte.motivo] || reporte.motivo}</strong>
        <span className="insignia">{reporte.estado}</span>
      </div>

      <div className="tarjeta-meta">
        Reportado por {reporte.reportante_id?.nombre_usuario || 'alguien'} ·{' '}
        {new Date(reporte.fecha_creacion).toLocaleString('es-ES')}
      </div>

      {reporte.detalle && <p className="reporte-detalle">«{reporte.detalle}»</p>}

      <VistaContenido contenidoTipo={reporte.contenido_tipo} contenido={reporte.contenido} />

      {!resuelto && (
        <Asignacion tipo="reportes" item={reporte} onCambio={(cambio) => setReporte({ ...reporte, ...cambio })} />
      )}
      <NotasInternas contenidoTipo={reporte.contenido_tipo} contenidoId={reporte.contenido_id} />

      {resuelto ? (
        <div className="tarjeta-meta">
          Resuelto por {reporte.moderador_id?.nombre_usuario || 'un moderador'}
          {reporte.fecha_revision && ` el ${new Date(reporte.fecha_revision).toLocaleString('es-ES')}`}
          {reporte.nota_moderador && `: ${reporte.nota_moderador}`}
        </div>
      ) : (
        <>
          <div className="botones-reaccion">
            <button
              type="button"
              onClick={() => setDecision('aceptado')}
              className={decision === 'aceptado' ? 'activa' : undefined}
            >
              Aceptar el reporte
            </button>
            <button
              type="button"
              onClick={() => setDecision('rechazado')}
              className={decision === 'rechazado' ? 'activa' : undefined}
            >
              Descartarlo
            </button>
          </div>

          {decision && (
            <form onSubmit={resolver} className="formulario-resolucion">
              {decision === 'aceptado' && (
                <label>
                  Qué hacer con el contenido
                  <select value={accion} onChange={(evento) => setAccion(evento.target.value)}>
                    <option value="ocultar">Ocultarlo</option>
                    <option value="eliminar">Eliminarlo</option>
                    <option value="ninguna">Nada, solo dar por válido el reporte</option>
                  </select>
                </label>
              )}

              <label>
                Motivo {decision === 'aceptado' ? '(se le envía al autor)' : '(interno)'}
                <input
                  value={nota}
                  maxLength={500}
                  onChange={(evento) => setNota(evento.target.value)}
                  placeholder={
                    decision === 'aceptado' ? 'Por qué se sanciona' : 'Por qué no procede este reporte'
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

              {decision === 'rechazado' && (
                <p className="tarjeta-meta">
                  Si este era el último reporte pendiente y el contenido estaba oculto por acumularlos, al
                  descartarlo volverá a publicarse.
                </p>
              )}

              {error && <p className="mensaje-error">{error}</p>}
            </form>
          )}
        </>
      )}
    </article>
  );
}

export default FilaReporte;
