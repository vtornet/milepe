import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import FotoFormulario from './FotoFormulario.jsx';
import FotoTarjeta from './FotoTarjeta.jsx';

function FotosPage() {
  const { usuario } = useAuth();
  const [fotos, setFotos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [epoca, setEpoca] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);

    const params = {};
    if (epoca) params.epoca = epoca;

    api
      .get('/fotos', { params })
      .then(({ data }) => {
        if (!cancelado) setFotos(data.fotos);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudieron cargar las fotos.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [epoca]);

  const manejarFotoCreada = (fotoNueva) => {
    setFotos([fotoNueva, ...fotos]);
    setMostrarFormulario(false);
  };

  return (
    <section>
      <h1>Fotos</h1>

      {usuario ? (
        <button type="button" onClick={() => setMostrarFormulario(!mostrarFormulario)} style={{ marginBottom: 14 }}>
          {mostrarFormulario ? 'Cancelar' : '+ Nueva foto'}
        </button>
      ) : (
        <p className="tarjeta-meta">Inicia sesión para poder publicar una foto.</p>
      )}

      {mostrarFormulario && <FotoFormulario onCreada={manejarFotoCreada} />}

      <div className="lista-filtros">
        <select value={epoca} onChange={(e) => setEpoca(e.target.value)}>
          <option value="">Todas las épocas</option>
          <option value="actual">Actuales</option>
          <option value="antigua">Antiguas</option>
        </select>
      </div>

      {cargando && <p>Cargando...</p>}
      {error && <p className="mensaje-error">{error}</p>}
      {!cargando && !error && fotos.length === 0 && <p>No hay fotos con este filtro todavía.</p>}

      {fotos.map((foto) => (
        <FotoTarjeta key={foto._id} foto={foto} />
      ))}
    </section>
  );
}

export default FotosPage;
