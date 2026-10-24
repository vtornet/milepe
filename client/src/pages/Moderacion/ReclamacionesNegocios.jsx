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
      <p>{r.mensaje}</p>
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
