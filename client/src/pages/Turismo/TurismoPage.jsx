import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import CabeceraSeccion from '../../components/CabeceraSeccion.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import Icono from '../../components/Icono.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
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
      <CabeceraSeccion
        ruta="/turismo"
        descripcion="Playas, rutas y dónde comer bien, según los vecinos"
        textoNuevo="Nueva recomendación"
        formularioAbierto={mostrarFormulario}
        onAlternarFormulario={() => setMostrarFormulario(!mostrarFormulario)}
      />

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

      {cargando && <EsqueletoFeed />}
      {error && (
        <div className="aviso aviso-error">
          <Icono nombre="alerta" tam={18} />
          <span>{error}</span>
        </div>
      )}
      {!cargando && !error && items.length === 0 && (
        <EstadoVacio icono="turismo" titulo="Todavía no hay recomendaciones">
          Comparte una playa, una ruta o un sitio donde se coma bien.
        </EstadoVacio>
      )}

      {items.map((item) => (
        <TurismoTarjeta key={item._id} turismo={item} />
      ))}
    </section>
  );
}

export default TurismoPage;
