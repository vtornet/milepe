import { useState } from 'react';
import api from '../../services/api.js';
import SelectorUbicacion from '../Quejas/SelectorUbicacion.jsx';

// Mismo enum que server/src/models/EventoDetalle.js (CATEGORIAS_EVENTO).
const CATEGORIAS = [
  { valor: 'feria', etiqueta: 'Feria' },
  { valor: 'fiesta_patronal', etiqueta: 'Fiesta patronal' },
  { valor: 'concierto', etiqueta: 'Concierto' },
  { valor: 'deportivo', etiqueta: 'Deportivo' },
  { valor: 'cultural', etiqueta: 'Cultural' },
  { valor: 'otro', etiqueta: 'Otro' },
];

const DATOS_INICIALES = { titulo: '', contenido: '', categoria: 'feria', fecha_inicio: '', fecha_fin: '', lugar: '' };

function EventoFormulario({ onCreado }) {
  const [datos, setDatos] = useState(DATOS_INICIALES);
  const [ubicacion, setUbicacion] = useState(null);
  const [marcarUbicacion, setMarcarUbicacion] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const manejarCambio = (evento) => {
    setDatos({ ...datos, [evento.target.name]: evento.target.value });
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const { data } = await api.post('/eventos', {
        ...datos,
        fecha_fin: datos.fecha_fin || undefined,
        ubicacion: marcarUbicacion && ubicacion ? ubicacion : undefined,
      });
      onCreado(data.evento);
      setDatos(DATOS_INICIALES);
      setUbicacion(null);
      setMarcarUbicacion(false);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo crear el evento');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="tarjeta" onSubmit={manejarEnvio}>
      <h2>Nuevo evento</h2>

      <label htmlFor="titulo">Título</label>
      <input id="titulo" name="titulo" required maxLength={120} value={datos.titulo} onChange={manejarCambio} />

      <label htmlFor="contenido">Descripción</label>
      <textarea
        id="contenido"
        name="contenido"
        rows={3}
        required
        maxLength={5000}
        value={datos.contenido}
        onChange={manejarCambio}
      />

      <label htmlFor="categoria">Categoría</label>
      <select id="categoria" name="categoria" value={datos.categoria} onChange={manejarCambio}>
        {CATEGORIAS.map((c) => (
          <option key={c.valor} value={c.valor}>
            {c.etiqueta}
          </option>
        ))}
      </select>

      <label htmlFor="lugar">Lugar</label>
      <input id="lugar" name="lugar" required maxLength={150} value={datos.lugar} onChange={manejarCambio} />

      <div className="fila-fechas">
        <div>
          <label htmlFor="fecha_inicio">Fecha y hora de inicio</label>
          <input
            id="fecha_inicio"
            name="fecha_inicio"
            type="datetime-local"
            required
            value={datos.fecha_inicio}
            onChange={manejarCambio}
          />
        </div>
        <div>
          <label htmlFor="fecha_fin">Fecha y hora de fin (opcional)</label>
          <input id="fecha_fin" name="fecha_fin" type="datetime-local" value={datos.fecha_fin} onChange={manejarCambio} />
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
        <input
          type="checkbox"
          checked={marcarUbicacion}
          onChange={(e) => setMarcarUbicacion(e.target.checked)}
          style={{ width: 'auto' }}
        />
        Marcar la ubicación exacta en el mapa (opcional)
      </label>
      {marcarUbicacion && <SelectorUbicacion value={ubicacion} onChange={setUbicacion} />}

      {error && <p className="mensaje-error">{error}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Publicando...' : 'Publicar evento'}
      </button>
    </form>
  );
}

export default EventoFormulario;
