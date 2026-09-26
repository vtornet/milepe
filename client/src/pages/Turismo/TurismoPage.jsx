import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import TurismoFormulario from './TurismoFormulario.jsx';
import TurismoTarjeta from './TurismoTarjeta.jsx';

const CATEGORIAS = [
  { valor: '', etiqueta: 'Todas las categorías' },
  { valor: 'playa', etiqueta: 'Playa' },
  { valor: 'ruta', etiqueta: 'Ruta' },
  { valor: 'gastronomia', etiqueta: 'Gastronomía' },
  { valor: 'otro', etiqueta: 'Otro' },
];

function TurismoPage() {
  const { usuario } = useAuth();
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [categoria, setCategoria] = useState('');
  const [cercaDeMi, setCercaDeMi] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);

    const params = {};
    if (categoria) params.categoria = categoria;
    if (cercaDeMi) {
      params.lat = cercaDeMi.lat;
      params.lng = cercaDeMi.lng;
      params.radioKm = 15;
    }

    api
      .get('/turismo', { params })
      .then(({ data }) => {
        if (!cancelado) setItems(data.turismo);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo cargar el contenido de turismo.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [categoria, cercaDeMi]);

  const buscarCercaDeMi = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no permite compartir tu ubicación.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicion) => setCercaDeMi({ lat: posicion.coords.latitude, lng: posicion.coords.longitude }),
      () => alert('No se pudo obtener tu ubicación.'),
    );
  };

  const manejarCreado = (nuevo) => {
    setItems([nuevo, ...items]);
    setMostrarFormulario(false);
  };

  return (
    <section>
      <h1>Turismo</h1>

      {usuario ? (
        <button type="button" onClick={() => setMostrarFormulario(!mostrarFormulario)} style={{ marginBottom: 14 }}>
          {mostrarFormulario ? 'Cancelar' : '+ Nueva recomendación'}
        </button>
      ) : (
        <p className="tarjeta-meta">Inicia sesión para poder publicar una recomendación.</p>
      )}

      {mostrarFormulario && <TurismoFormulario onCreado={manejarCreado} />}

      <div className="lista-filtros">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {CATEGORIAS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.etiqueta}
            </option>
          ))}
        </select>
        <button type="button" onClick={buscarCercaDeMi}>
          📍 {cercaDeMi ? 'Cerca de mí (activo)' : 'Cerca de mí'}
        </button>
        {cercaDeMi && (
          <button type="button" onClick={() => setCercaDeMi(null)}>
            Quitar
          </button>
        )}
      </div>

      {cargando && <p>Cargando...</p>}
      {error && <p className="mensaje-error">{error}</p>}
      {!cargando && !error && items.length === 0 && <p>No hay nada con este filtro todavía.</p>}

      {items.map((item) => (
        <TurismoTarjeta key={item._id} turismo={item} />
      ))}
    </section>
  );
}

export default TurismoPage;
