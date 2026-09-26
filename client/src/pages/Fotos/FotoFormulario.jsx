import { useState } from 'react';
import api from '../../services/api.js';

// Igual que el servidor (FotoDetalle.js): decada mas antigua aceptada, y la
// decada actual se calcula igual (año actual redondeado hacia abajo a la
// decena) para que el desplegable nunca ofrezca una decada que el servidor
// fuera a rechazar.
const DECADA_MINIMA = 1900;
const DECADA_ACTUAL = Math.floor(new Date().getFullYear() / 10) * 10;
const DECADAS = [];
for (let d = DECADA_ACTUAL; d >= DECADA_MINIMA; d -= 10) DECADAS.push(d);

const DATOS_INICIALES = { titulo: '', contenido: '', epoca: 'actual', decada: DECADAS[0] };

function FotoFormulario({ onCreada }) {
  const [datos, setDatos] = useState(DATOS_INICIALES);
  const [archivos, setArchivos] = useState([]);
  const [error, setError] = useState(null);
  const [subiendo, setSubiendo] = useState(false);

  const manejarCambio = (evento) => {
    setDatos({ ...datos, [evento.target.name]: evento.target.value });
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    setError(null);

    if (archivos.length === 0) {
      setError('Elige al menos una foto.');
      return;
    }

    setSubiendo(true);
    try {
      const formData = new FormData();
      archivos.forEach((archivo) => formData.append('imagenes', archivo));

      const { data: subida } = await api.post('/subidas/imagenes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { data } = await api.post('/fotos', {
        titulo: datos.titulo,
        contenido: datos.contenido,
        imagenes: subida.imagenes,
        epoca: datos.epoca,
        decada: datos.epoca === 'antigua' ? Number(datos.decada) : undefined,
      });

      onCreada(data.foto);
      setDatos(DATOS_INICIALES);
      setArchivos([]);
      evento.target.reset();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo publicar la foto');
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <form className="tarjeta" onSubmit={manejarEnvio}>
      <h2>Nueva foto</h2>

      <label htmlFor="titulo">Título</label>
      <input id="titulo" name="titulo" required maxLength={120} value={datos.titulo} onChange={manejarCambio} />

      <label htmlFor="contenido">Descripción</label>
      <textarea
        id="contenido"
        name="contenido"
        rows={2}
        required
        maxLength={5000}
        value={datos.contenido}
        onChange={manejarCambio}
      />

      <label htmlFor="epoca">Época</label>
      <select id="epoca" name="epoca" value={datos.epoca} onChange={manejarCambio}>
        <option value="actual">Actual</option>
        <option value="antigua">Antigua</option>
      </select>

      {datos.epoca === 'antigua' && (
        <>
          <label htmlFor="decada">Década</label>
          <select id="decada" name="decada" value={datos.decada} onChange={manejarCambio}>
            {DECADAS.map((d) => (
              <option key={d} value={d}>
                Años {d}
              </option>
            ))}
          </select>
        </>
      )}

      <label htmlFor="archivos">Fotos (puedes elegir varias)</label>
      <input
        id="archivos"
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => setArchivos(Array.from(e.target.files))}
      />

      {error && <p className="mensaje-error">{error}</p>}

      <button type="submit" disabled={subiendo}>
        {subiendo ? 'Subiendo...' : 'Publicar foto'}
      </button>
    </form>
  );
}

export default FotoFormulario;
