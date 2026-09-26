import { useState } from 'react';
import api from '../../services/api.js';
import SelectorUbicacion from '../Quejas/SelectorUbicacion.jsx';

// Mismo enum que server/src/models/TurismoDetalle.js (CATEGORIAS_TURISMO).
const CATEGORIAS = [
  { valor: 'playa', etiqueta: 'Playa' },
  { valor: 'ruta', etiqueta: 'Ruta' },
  { valor: 'gastronomia', etiqueta: 'Gastronomía' },
  { valor: 'otro', etiqueta: 'Otro' },
];

const DATOS_INICIALES = { titulo: '', contenido: '', categoria: 'playa' };

function TurismoFormulario({ onCreado }) {
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
      const { data } = await api.post('/turismo', {
        ...datos,
        ubicacion: marcarUbicacion && ubicacion ? ubicacion : undefined,
      });
      onCreado(data.turismo);
      setDatos(DATOS_INICIALES);
      setUbicacion(null);
      setMarcarUbicacion(false);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo publicar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="tarjeta" onSubmit={manejarEnvio}>
      <h2>Nueva recomendación</h2>

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

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
        <input
          type="checkbox"
          checked={marcarUbicacion}
          onChange={(e) => setMarcarUbicacion(e.target.checked)}
          style={{ width: 'auto' }}
        />
        Marcar ubicación en el mapa (opcional — recomendado para playas y rutas)
      </label>
      {marcarUbicacion && <SelectorUbicacion value={ubicacion} onChange={setUbicacion} />}

      {error && <p className="mensaje-error">{error}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Publicando...' : 'Publicar'}
      </button>
    </form>
  );
}

export default TurismoFormulario;
