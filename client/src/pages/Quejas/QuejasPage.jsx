import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import CabeceraSeccion from '../../components/CabeceraSeccion.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import Icono from '../../components/Icono.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
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
      <CabeceraSeccion
        ruta="/quejas"
        descripcion="Avisos al Ayuntamiento sobre lo que hay que arreglar en el pueblo"
        textoNuevo="Nueva queja"
        formularioAbierto={mostrarFormulario}
        onAlternarFormulario={() => setMostrarFormulario(!mostrarFormulario)}
      />

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

      {cargando && <EsqueletoFeed />}
      {error && (
        <div className="aviso aviso-error">
          <Icono nombre="alerta" tam={18} />
          <span>{error}</span>
        </div>
      )}
      {!cargando && !error && quejas.length === 0 && (
        <EstadoVacio icono="quejas" titulo="No hay quejas con este filtro">
          Prueba a quitar los filtros, o escribe la primera de esta categoría.
        </EstadoVacio>
      )}

      {quejas.map((queja) => (
        <QuejaTarjeta key={queja._id} queja={queja} />
      ))}
    </section>
  );
}

export default QuejasPage;
