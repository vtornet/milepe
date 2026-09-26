import { useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import PanelInteraccion from '../../components/PanelInteraccion.jsx';

const ETIQUETA_SECTOR = { agricola: 'Agrícola', hosteleria: 'Hostelería', construccion: 'Construcción', comercio: 'Comercio', otros: 'Otros' };

function EmpleoTarjeta({ empleo, onRepublicado }) {
  const { usuario } = useAuth();
  const [republicando, setRepublicando] = useState(false);
  const esAutor = usuario && empleo.autor?._id === usuario._id;
  const caducada = empleo.modalidad === 'ofrezco' && empleo.estado_oferta === 'caducada';

  const republicar = async () => {
    setRepublicando(true);
    try {
      await api.patch(`/empleo/${empleo._id}/republicar`);
      onRepublicado(empleo._id);
    } catch {
      alert('No se pudo republicar la oferta.');
    } finally {
      setRepublicando(false);
    }
  };

  return (
    <article className="tarjeta">
      <span className="insignia">{ETIQUETA_SECTOR[empleo.sector] || empleo.sector}</span>
      {caducada && <span className="insignia">Caducada</span>}
      <h2>{empleo.titulo}</h2>
      <p>{empleo.contenido}</p>

      {empleo.modalidad === 'busco' ? (
        <div className="tarjeta-meta">
          📍 {empleo.zona} · Disponible desde {new Date(empleo.disponible_desde).toLocaleDateString('es-ES')}
        </div>
      ) : (
        <div className="tarjeta-meta">
          💼 {empleo.puesto} · 💶 {empleo.jornal} €/día · Caduca el {new Date(empleo.fecha_caducidad).toLocaleDateString('es-ES')}
        </div>
      )}

      <div className="tarjeta-meta">Por {empleo.autor?.nombre_usuario || 'alguien'}</div>

      {caducada && esAutor && (
        <button type="button" onClick={republicar} disabled={republicando} style={{ marginTop: 8 }}>
          {republicando ? 'Republicando...' : 'Republicar (+30 días)'}
        </button>
      )}

      <PanelInteraccion postId={empleo._id} reaccionesIniciales={empleo.reacciones} />
    </article>
  );
}

export default EmpleoTarjeta;
