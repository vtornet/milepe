import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import CabeceraSeccion from '../../components/CabeceraSeccion.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import Icono from '../../components/Icono.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import NegocioFormulario from './NegocioFormulario.jsx';
import NegocioTarjeta from './NegocioTarjeta.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

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
  const [negocios, setNegocios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [categoria, setCategoria] = useState('');
  const [cercaDeMi, setCercaDeMi] = useState(null); // { lat, lng } o null
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const { usuario } = useAuth();
  // Negocios que tengo reclamados y sin resolver: su tarjeta lo dice.
  const [reclamados, setReclamados] = useState([]);

  useEffect(() => {
    if (!usuario) return;
    api
      .get('/negocios/mis-reclamaciones')
      .then(({ data }) => setReclamados(data.negocios))
      .catch(() => {});
  }, [usuario]);

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
    // Sin alert(): un diálogo del navegador bloquea la página y parece un
    // fallo del sistema. El aviso sale en la propia página.
    setError(null);
    if (!navigator.geolocation) {
      setError('Tu navegador no permite compartir tu ubicación.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicion) => setCercaDeMi({ lat: posicion.coords.latitude, lng: posicion.coords.longitude }),
      () => setError('No se pudo obtener tu ubicación. Revisa el permiso de ubicación del navegador.'),
    );
  };

  const manejarNegocioCreado = (negocioNuevo, { reclamacionPendiente } = {}) => {
    setNegocios([negocioNuevo, ...negocios]);
    if (reclamacionPendiente) setReclamados((actuales) => [...actuales, negocioNuevo._id]);
    setMostrarFormulario(false);
  };

  return (
    <section>
      <CabeceraSeccion
        ruta="/negocios"
        descripcion="El comercio de Lepe, con teléfono, horario y reseñas"
        textoNuevo="Nuevo negocio"
        formularioAbierto={mostrarFormulario}
        onAlternarFormulario={() => setMostrarFormulario(!mostrarFormulario)}
      />

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
          <Icono nombre="ubicacion" tam={16} /> {cercaDeMi ? 'Cerca de mí (activo)' : 'Cerca de mí'}
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
      {!cargando && !error && negocios.length === 0 && (
        <EstadoVacio icono="negocios" titulo="No hay negocios con este filtro">
          Prueba a quitar los filtros, o da de alta el primero de esta categoría.
        </EstadoVacio>
      )}

      {negocios.map((negocio) => (
        <NegocioTarjeta
          key={negocio._id}
          negocio={negocio}
          reclamacionPendiente={reclamados.includes(negocio._id)}
          onReclamado={() => setReclamados((actuales) => [...actuales, negocio._id])}
        />
      ))}
    </section>
  );
}

export default NegociosPage;
