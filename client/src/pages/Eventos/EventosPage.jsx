import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import CabeceraSeccion from '../../components/CabeceraSeccion.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import Icono from '../../components/Icono.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import EventoFormulario from './EventoFormulario.jsx';
import EventoTarjeta from './EventoTarjeta.jsx';

const CATEGORIAS = [
  { valor: '', etiqueta: 'Todas las categorías' },
  { valor: 'feria', etiqueta: 'Feria' },
  { valor: 'fiesta_patronal', etiqueta: 'Fiesta patronal' },
  { valor: 'concierto', etiqueta: 'Concierto' },
  { valor: 'deportivo', etiqueta: 'Deportivo' },
  { valor: 'cultural', etiqueta: 'Cultural' },
  { valor: 'otro', etiqueta: 'Otro' },
];

function EventosPage() {
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [categoria, setCategoria] = useState('');
  const [incluirPasados, setIncluirPasados] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);

    const params = {};
    if (categoria) params.categoria = categoria;
    if (incluirPasados) params.incluirPasados = 'true';

    api
      .get('/eventos', { params })
      .then(({ data }) => {
        if (!cancelado) setEventos(data.eventos);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudieron cargar los eventos.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [categoria, incluirPasados]);

  const manejarEventoCreado = () => {
    // Un evento recien creado puede no encajar en el orden/filtro actual de
    // la agenda (p. ej. si "incluirPasados" esta desactivado y su fecha ya
    // paso); mas sencillo y siempre correcto que insertarlo a mano es
    // recargar la lista completa con el filtro vigente.
    setMostrarFormulario(false);
    const params = {};
    if (categoria) params.categoria = categoria;
    if (incluirPasados) params.incluirPasados = 'true';
    api.get('/eventos', { params }).then(({ data }) => setEventos(data.eventos));
  };

  return (
    <section>
      <CabeceraSeccion
        ruta="/eventos"
        descripcion="La agenda de Lepe: ferias, conciertos, deporte y fiestas"
        textoNuevo="Nuevo evento"
        formularioAbierto={mostrarFormulario}
        onAlternarFormulario={() => setMostrarFormulario(!mostrarFormulario)}
      />

      {mostrarFormulario && <EventoFormulario onCreado={manejarEventoCreado} />}

      <div className="lista-filtros">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {CATEGORIAS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.etiqueta}
            </option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={incluirPasados}
            onChange={(e) => setIncluirPasados(e.target.checked)}
            style={{ width: 'auto' }}
          />
          Incluir pasados
        </label>
      </div>

      {cargando && <EsqueletoFeed />}
      {error && (
        <div className="aviso aviso-error">
          <Icono nombre="alerta" tam={18} />
          <span>{error}</span>
        </div>
      )}
      {!cargando && !error && eventos.length === 0 && (
        <EstadoVacio icono="eventos" titulo="No hay eventos a la vista">
          Aquí aparecen los próximos, ordenados por fecha. Marca «incluir pasados» para ver los ya celebrados.
        </EstadoVacio>
      )}

      {eventos.map((evento) => (
        <EventoTarjeta key={evento._id} evento={evento} />
      ))}
    </section>
  );
}

export default EventosPage;
