import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import QuejaFormulario from './QuejaFormulario.jsx';
import QuejaTarjeta from './QuejaTarjeta.jsx';

const CATEGORIAS = [
  { valor: '', etiqueta: 'Todas las categorías' },
  { valor: 'limpieza', etiqueta: 'Limpieza' },
  { valor: 'suministros', etiqueta: 'Suministros' },
  { valor: 'obras', etiqueta: 'Obras' },
  { valor: 'jardineria', etiqueta: 'Jardinería' },
  { valor: 'general', etiqueta: 'General' },
];

const ESTADOS = [
  { valor: '', etiqueta: 'Todos los estados' },
  { valor: 'pendiente', etiqueta: 'Pendiente' },
  { valor: 'en_curso', etiqueta: 'En curso' },
  { valor: 'resuelto', etiqueta: 'Resuelto' },
];

function QuejasPage() {
  const { usuario } = useAuth();
  const [quejas, setQuejas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [categoria, setCategoria] = useState('');
  const [estado, setEstado] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);

    const params = {};
    if (categoria) params.categoria = categoria;
    if (estado) params.estado = estado;

    api
      .get('/quejas', { params })
      .then(({ data }) => {
        if (!cancelado) setQuejas(data.quejas);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudieron cargar las quejas.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [categoria, estado]);

  const manejarQuejaCreada = (quejaNueva) => {
    setQuejas([quejaNueva, ...quejas]);
    setMostrarFormulario(false);
  };

  return (
    <section>
      <h1>Quejas</h1>

      {usuario ? (
        <button type="button" onClick={() => setMostrarFormulario(!mostrarFormulario)} style={{ marginBottom: 14 }}>
          {mostrarFormulario ? 'Cancelar' : '+ Nueva queja'}
        </button>
      ) : (
        <p className="tarjeta-meta">Inicia sesión para poder publicar una queja.</p>
      )}

      {mostrarFormulario && <QuejaFormulario onCreada={manejarQuejaCreada} />}

      <div className="lista-filtros">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {CATEGORIAS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.etiqueta}
            </option>
          ))}
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          {ESTADOS.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.etiqueta}
            </option>
          ))}
        </select>
      </div>

      {cargando && <p>Cargando...</p>}
      {error && <p className="mensaje-error">{error}</p>}
      {!cargando && !error && quejas.length === 0 && <p>No hay quejas con este filtro.</p>}

      {quejas.map((queja) => (
        <QuejaTarjeta key={queja._id} queja={queja} />
      ))}
    </section>
  );
}

export default QuejasPage;
