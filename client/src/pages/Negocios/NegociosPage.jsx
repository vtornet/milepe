import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import NegocioFormulario from './NegocioFormulario.jsx';
import NegocioTarjeta from './NegocioTarjeta.jsx';

const CATEGORIAS = [
  { valor: '', etiqueta: 'Todas las categorías' },
  { valor: 'restauracion', etiqueta: 'Restauración' },
  { valor: 'alojamiento', etiqueta: 'Alojamiento' },
  { valor: 'comercio', etiqueta: 'Comercio' },
  { valor: 'servicios', etiqueta: 'Servicios' },
  { valor: 'ocio', etiqueta: 'Ocio' },
  { valor: 'otros', etiqueta: 'Otros' },
];

function NegociosPage() {
  const { usuario } = useAuth();
  const [negocios, setNegocios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [categoria, setCategoria] = useState('');
  const [cercaDeMi, setCercaDeMi] = useState(null); // { lat, lng } o null
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
      .get('/negocios', { params })
      .then(({ data }) => {
        if (!cancelado) setNegocios(data.negocios);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudieron cargar los negocios.');
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

  const manejarNegocioCreado = (negocioNuevo) => {
    setNegocios([negocioNuevo, ...negocios]);
    setMostrarFormulario(false);
  };

  return (
    <section>
      <h1>Negocios locales</h1>

      {usuario ? (
        <button type="button" onClick={() => setMostrarFormulario(!mostrarFormulario)} style={{ marginBottom: 14 }}>
          {mostrarFormulario ? 'Cancelar' : '+ Nuevo negocio'}
        </button>
      ) : (
        <p className="tarjeta-meta">Inicia sesión para poder publicar un negocio.</p>
      )}

      {mostrarFormulario && <NegocioFormulario onCreado={manejarNegocioCreado} />}

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
      {!cargando && !error && negocios.length === 0 && <p>No hay negocios con este filtro.</p>}

      {negocios.map((negocio) => (
        <NegocioTarjeta key={negocio._id} negocio={negocio} />
      ))}
    </section>
  );
}

export default NegociosPage;
