import { useState } from 'react';
import api from '../../services/api.js';
import SelectorUbicacion from './SelectorUbicacion.jsx';

// Mismo enum que server/src/models/QuejaDetalle.js (CATEGORIAS_QUEJA). No
// hay forma de compartirlo automaticamente entre server y client (son dos
// runtimes/paquetes independientes) asi que si se añade una categoria ahi,
// hay que añadirla aqui tambien.
const CATEGORIAS = [
  { valor: 'limpieza', etiqueta: 'Limpieza' },
  { valor: 'suministros', etiqueta: 'Suministros (luz/agua)' },
  { valor: 'obras', etiqueta: 'Obras' },
  { valor: 'jardineria', etiqueta: 'Jardinería' },
  { valor: 'general', etiqueta: 'General' },
];

const DATOS_INICIALES = { titulo: '', contenido: '', categoria: 'general', direccion_aproximada: '' };

// onCreada se llama con la queja recien creada para que QuejasPage la meta
// al principio del listado sin tener que recargar todo.
function QuejaFormulario({ onCreada }) {
  const [datos, setDatos] = useState(DATOS_INICIALES);
  const [ubicacion, setUbicacion] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const manejarCambio = (evento) => {
    setDatos({ ...datos, [evento.target.name]: evento.target.value });
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    setError(null);

    if (!ubicacion) {
      setError('Marca en el mapa dónde está el problema.');
      return;
    }

    setEnviando(true);
    try {
      const { data } = await api.post('/quejas', { ...datos, ubicacion });
      onCreada(data.queja);
      setDatos(DATOS_INICIALES);
      setUbicacion(null);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo crear la queja');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="tarjeta" onSubmit={manejarEnvio}>
      <h2>Nueva queja</h2>

      <label htmlFor="titulo">Título</label>
      <input id="titulo" name="titulo" required maxLength={120} value={datos.titulo} onChange={manejarCambio} />

      <label htmlFor="contenido">¿Qué pasa?</label>
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

      <label htmlFor="direccion_aproximada">Dirección aproximada (opcional)</label>
      <input id="direccion_aproximada" name="direccion_aproximada" value={datos.direccion_aproximada} onChange={manejarCambio} />

      <label>Ubicación (haz clic en el mapa)</label>
      <SelectorUbicacion value={ubicacion} onChange={setUbicacion} />

      {error && <p className="mensaje-error">{error}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Publicando...' : 'Publicar queja'}
      </button>
    </form>
  );
}

export default QuejaFormulario;
