import { useState } from 'react';
import api from '../../services/api.js';
import SelectorUbicacion from '../Quejas/SelectorUbicacion.jsx';

// Mismo enum que server/src/models/NegocioDetalle.js (CATEGORIAS_NEGOCIO).
const CATEGORIAS = [
  { valor: 'restauracion', etiqueta: 'Restauración' },
  { valor: 'alojamiento', etiqueta: 'Alojamiento' },
  { valor: 'comercio', etiqueta: 'Comercio' },
  { valor: 'servicios', etiqueta: 'Servicios' },
  { valor: 'ocio', etiqueta: 'Ocio' },
  { valor: 'otros', etiqueta: 'Otros' },
];

const DATOS_INICIALES = {
  titulo: '', contenido: '', categoria: 'restauracion', direccion: '', telefono: '', horario: '', sitio_web: '',
};

function NegocioFormulario({ onCreado }) {
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
      setError('Marca en el mapa dónde está el negocio.');
      return;
    }

    setEnviando(true);
    try {
      const { data } = await api.post('/negocios', { ...datos, ubicacion });
      onCreado(data.negocio);
      setDatos(DATOS_INICIALES);
      setUbicacion(null);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo publicar el negocio');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="tarjeta" onSubmit={manejarEnvio}>
      <h2>Nuevo negocio</h2>

      <label htmlFor="titulo">Nombre del negocio</label>
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

      <label htmlFor="direccion">Dirección</label>
      <input id="direccion" name="direccion" required maxLength={200} value={datos.direccion} onChange={manejarCambio} />

      <div className="fila-fechas">
        <div>
          <label htmlFor="telefono">Teléfono (opcional)</label>
          <input id="telefono" name="telefono" value={datos.telefono} onChange={manejarCambio} />
        </div>
        <div>
          <label htmlFor="sitio_web">Sitio web (opcional)</label>
          <input id="sitio_web" name="sitio_web" value={datos.sitio_web} onChange={manejarCambio} />
        </div>
      </div>

      <label htmlFor="horario">Horario (opcional)</label>
      <input
        id="horario"
        name="horario"
        placeholder="L-V 9:00-14:00 y 17:00-20:00"
        value={datos.horario}
        onChange={manejarCambio}
      />

      <label>Ubicación (haz clic en el mapa)</label>
      <SelectorUbicacion value={ubicacion} onChange={setUbicacion} />

      {error && <p className="mensaje-error">{error}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Publicando...' : 'Publicar negocio'}
      </button>
    </form>
  );
}

export default NegocioFormulario;
