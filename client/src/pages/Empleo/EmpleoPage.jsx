import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import EmpleoFormulario from './EmpleoFormulario.jsx';
import EmpleoTarjeta from './EmpleoTarjeta.jsx';

const SECTORES = [
  { valor: '', etiqueta: 'Todos los sectores' },
  { valor: 'agricola', etiqueta: 'Agrícola' },
  { valor: 'hosteleria', etiqueta: 'Hostelería' },
  { valor: 'construccion', etiqueta: 'Construcción' },
  { valor: 'comercio', etiqueta: 'Comercio' },
  { valor: 'otros', etiqueta: 'Otros' },
];

function EmpleoPage() {
  const { usuario } = useAuth();
  const [modalidad, setModalidad] = useState('ofrezco');
  const [sector, setSector] = useState('');
  const [incluirCaducadas, setIncluirCaducadas] = useState(false);
  const [empleos, setEmpleos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);

    const params = { modalidad };
    if (sector) params.sector = sector;
    if (modalidad === 'ofrezco' && incluirCaducadas) params.incluirCaducadas = 'true';

    api
      .get('/empleo', { params })
      .then(({ data }) => {
        if (!cancelado) setEmpleos(data.empleo);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo cargar el listado de empleo.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [modalidad, sector, incluirCaducadas]);

  const manejarCreado = (nuevo) => {
    setMostrarFormulario(false);
    if (nuevo.modalidad === modalidad) setEmpleos([nuevo, ...empleos]);
  };

  // Tras republicar cambia estado_oferta/fecha_caducidad: mas sencillo y
  // siempre correcto recargar el listado con el filtro vigente que ir
  // actualizando la tarjeta a mano.
  const manejarRepublicado = () => {
    const params = { modalidad };
    if (sector) params.sector = sector;
    if (modalidad === 'ofrezco' && incluirCaducadas) params.incluirCaducadas = 'true';
    api.get('/empleo', { params }).then(({ data }) => setEmpleos(data.empleo));
  };

  return (
    <section>
      <h1>Empleo</h1>

      {usuario ? (
        <button type="button" onClick={() => setMostrarFormulario(!mostrarFormulario)} style={{ marginBottom: 14 }}>
          {mostrarFormulario ? 'Cancelar' : '+ Publicar'}
        </button>
      ) : (
        <p className="tarjeta-meta">Inicia sesión para poder publicar.</p>
      )}

      {mostrarFormulario && <EmpleoFormulario onCreado={manejarCreado} />}

      <div className="lista-filtros">
        <select value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
          <option value="ofrezco">Ofrezco trabajo</option>
          <option value="busco">Busco trabajo</option>
        </select>
        <select value={sector} onChange={(e) => setSector(e.target.value)}>
          {SECTORES.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.etiqueta}
            </option>
          ))}
        </select>
        {modalidad === 'ofrezco' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={incluirCaducadas}
              onChange={(e) => setIncluirCaducadas(e.target.checked)}
              style={{ width: 'auto' }}
            />
            Incluir caducadas
          </label>
        )}
      </div>

      {cargando && <p>Cargando...</p>}
      {error && <p className="mensaje-error">{error}</p>}
      {!cargando && !error && empleos.length === 0 && <p>No hay publicaciones con este filtro.</p>}

      {empleos.map((empleo) => (
        <EmpleoTarjeta key={empleo._id} empleo={empleo} onRepublicado={manejarRepublicado} />
      ))}
    </section>
  );
}

export default EmpleoPage;
