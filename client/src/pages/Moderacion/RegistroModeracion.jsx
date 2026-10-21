import { useEffect, useState } from 'react';
import api from '../../services/api.js';

const ETIQUETA_ACCION = {
  ocultar: 'ocultó',
  eliminar: 'eliminó',
  restaurar: 'restauró',
  auto_ocultar: 'se ocultó automáticamente',
  reporte_aceptado: 'aceptó un reporte sobre',
  reporte_rechazado: 'descartó un reporte sobre',
  apelacion_aceptada: 'aceptó la apelación sobre',
  apelacion_rechazada: 'rechazó la apelación sobre',
  revision_por_edicion: 'quedó pendiente de revisar por una edición de',
  edicion_aprobada: 'dio el visto bueno a la edición de',
};

const ACCIONES = Object.keys(ETIQUETA_ACCION);

// El registro de auditoría: quién hizo qué, cuándo y por qué. Es la pieza
// que permite responder "por qué está esto así" meses después y revisar el
// criterio de un moderador, que es justo lo que no se podía con el único
// campo moderador_id del post (ahí solo quedaba la última acción).
function RegistroModeracion() {
  const [registro, setRegistro] = useState(null);
  const [accion, setAccion] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    api
      .get('/moderacion/registro', { params: { limite: 50, accion: accion || undefined } })
      .then(({ data }) => {
        if (!cancelado) setRegistro(data.registro);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo cargar el registro.');
      });

    return () => {
      cancelado = true;
    };
  }, [accion]);

  if (error) return <p className="mensaje-error">{error}</p>;
  if (registro === null) return <p>Cargando registro...</p>;

  return (
    <>
      <div className="lista-filtros">
        <select value={accion} onChange={(evento) => setAccion(evento.target.value)}>
          <option value="">Todas las acciones</option>
          {ACCIONES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {registro.length === 0 && <p>No hay nada registrado todavía.</p>}

      {registro.map((entrada) => (
        <article key={entrada._id} className="tarjeta entrada-registro">
          <div>
            <strong>{entrada.moderador_id?.nombre_usuario || 'El sistema'}</strong>{' '}
            {ETIQUETA_ACCION[entrada.accion] || entrada.accion}{' '}
            {entrada.contenido_tipo === 'post' ? 'una publicación' : 'un comentario'} de{' '}
            <strong>{entrada.autor_contenido_id?.nombre_usuario || 'un vecino'}</strong>
          </div>

          <div className="tarjeta-meta">
            {new Date(entrada.fecha_creacion).toLocaleString('es-ES')}
            {entrada.estado_anterior && entrada.estado_nuevo && (
              <>
                {' '}
                · {entrada.estado_anterior} → {entrada.estado_nuevo}
              </>
            )}
          </div>

          {entrada.nota && <p className="reporte-detalle">«{entrada.nota}»</p>}
        </article>
      ))}
    </>
  );
}

export default RegistroModeracion;
