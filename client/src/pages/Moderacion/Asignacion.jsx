import { useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const hora = (iso) => new Date(iso).toLocaleString('es-ES', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

// "Me lo quedo" / "Soltar" de un reporte o una apelación pendiente, para que
// dos personas del equipo no revisen lo mismo a la vez. La asignación caduca
// sola a las 24 h (ver server/src/utils/asignacion.js).
function Asignacion({ tipo, item, onCambio }) {
  const { usuario } = useAuth();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  const vigente = item.asignado_a && new Date(item.asignado_hasta) > new Date();
  const esMio = vigente && String(item.asignado_a._id) === String(usuario?._id);
  const deOtro = vigente && !esMio;

  const cambiar = async (tomar) => {
    setError(null);
    setOcupado(true);
    try {
      const { data } = await api.patch(`/moderacion/${tipo}/${item._id}/asignacion`, { tomar });
      onCambio({ asignado_a: data.asignado_a, asignado_hasta: data.asignado_hasta });
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo cambiar la asignación.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="recurso-admin">
      {esMio && <span className="insignia insignia-info">Lo revisas tú hasta el {hora(item.asignado_hasta)}</span>}
      {deOtro && (
        <span className="insignia insignia-aviso">
          Lo revisa {item.asignado_a.nombre_usuario} hasta el {hora(item.asignado_hasta)}
        </span>
      )}
      {!vigente && <span className="tarjeta-meta">Sin asignar</span>}

      {!deOtro && (
        <button type="button" className="btn btn-contorno btn-sm" disabled={ocupado} onClick={() => cambiar(true)}>
          {esMio ? 'Renovar 24 h' : 'Me lo quedo'}
        </button>
      )}
      {(esMio || (deOtro && usuario?.rol === 'admin')) && (
        <button type="button" className="btn btn-plano btn-sm" disabled={ocupado} onClick={() => cambiar(false)}>
          Soltar
        </button>
      )}
      {error && <p className="mensaje-error">{error}</p>}
    </div>
  );
}

export default Asignacion;
