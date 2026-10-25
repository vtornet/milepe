import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import { fechaHora } from '../../utils/fechas.js';

// Cola del admin: vecinos que dicen ser dueños de un negocio. Aceptar le da
// la gestión de la ficha (y rechaza las demás reclamaciones del mismo).
function ReclamacionesNegocios() {
  const [reclamaciones, setReclamaciones] = useState(null);
  const [error, setError] = useState(null);

  const cargar = () =>
    api
      .get('/negocios/reclamaciones')
      .then(({ data }) => setReclamaciones(data.reclamaciones))
      .catch(() => setError('No se pudieron cargar las reclamaciones.'));

  useEffect(() => {
    cargar();
  }, []);

  const resolver = async (id, estado) => {
    setError(null);
    try {
      await api.patch(`/negocios/reclamaciones/${id}`, { estado });
      cargar();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo resolver');
    }
  };

  if (error) return <p className="mensaje-error">{error}</p>;
  if (!reclamaciones) return <p className="tarjeta-meta">Cargando…</p>;
  if (reclamaciones.length === 0) return <p className="tarjeta-meta">No hay reclamaciones de negocios pendientes.</p>;

  return reclamaciones.map((r) => (
    <article key={r._id} className="tarjeta">
      <strong>{r.post_id?.titulo || 'Negocio'}</strong>
      <div className="tarjeta-meta">
        La reclama {r.usuario_id?.nombre_usuario || 'un vecino'} · {fechaHora(r.fecha_creacion)}
      </div>
      {r.es_quien_lo_publico && <span className="insignia insignia-info">Lo publicó esta misma persona</span>}
      <p>«{r.mensaje}»</p>
      {/* Para comprobarlo sin fiarse solo del mensaje: llamar al local,
          mirar la web, pasarse por la dirección. */}
      <div className="tarjeta-meta">
        Para comprobarlo:{' '}
        {r.negocio?.telefono && (
          <>
            <a href={`tel:${r.negocio.telefono.replace(/[^\d+]/g, '')}`}>{r.negocio.telefono}</a> ·{' '}
          </>
        )}
        {r.negocio?.sitio_web && (
          <>
            <a href={r.negocio.sitio_web} target="_blank" rel="noreferrer">
              web
            </a>{' '}
            ·{' '}
          </>
        )}
        {r.negocio?.direccion}
        {r.post_id?._id && (
          <>
            {' · '}
            <a href={`/p/${r.post_id._id}`} target="_blank" rel="noreferrer">
              ver la ficha
            </a>
          </>
        )}
      </div>
      {r.negocio?.tiene_propietario && (
        <p className="tarjeta-meta">Este negocio ya tiene propietario: si aceptas, pasa a esta persona.</p>
      )}
      <div className="recurso-admin">
        <button type="button" className="btn btn-primario btn-sm" onClick={() => resolver(r._id, 'aceptada')}>
          Aceptar: es suyo
        </button>
        <button type="button" className="btn btn-contorno btn-sm" onClick={() => resolver(r._id, 'rechazada')}>
          Rechazar
        </button>
      </div>
    </article>
  ));
}

export default ReclamacionesNegocios;
