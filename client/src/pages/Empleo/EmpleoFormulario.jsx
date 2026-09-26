import { useState } from 'react';
import api from '../../services/api.js';

// Mismos enums que server/src/models/EmpleoDetalle.js.
const SECTORES = [
  { valor: 'agricola', etiqueta: 'Agrícola' },
  { valor: 'hosteleria', etiqueta: 'Hostelería' },
  { valor: 'construccion', etiqueta: 'Construcción' },
  { valor: 'comercio', etiqueta: 'Comercio' },
  { valor: 'otros', etiqueta: 'Otros' },
];

const DATOS_INICIALES = { modalidad: 'busco', titulo: '', contenido: '', sector: 'agricola', zona: '', puesto: '', jornal: '' };

function EmpleoFormulario({ onCreado }) {
  const [datos, setDatos] = useState(DATOS_INICIALES);
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
      const cuerpo = {
        modalidad: datos.modalidad,
        titulo: datos.titulo,
        contenido: datos.contenido,
        sector: datos.sector,
        ...(datos.modalidad === 'busco'
          ? { zona: datos.zona }
          : { puesto: datos.puesto, jornal: Number(datos.jornal) }),
      };
      const { data } = await api.post('/empleo', cuerpo);
      onCreado(data.empleo);
      setDatos(DATOS_INICIALES);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo publicar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="tarjeta" onSubmit={manejarEnvio}>
      <h2>Nueva publicación de empleo</h2>

      <label htmlFor="modalidad">¿Qué quieres hacer?</label>
      <select id="modalidad" name="modalidad" value={datos.modalidad} onChange={manejarCambio}>
        <option value="busco">Busco trabajo</option>
        <option value="ofrezco">Ofrezco trabajo</option>
      </select>

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

      <label htmlFor="sector">Sector</label>
      <select id="sector" name="sector" value={datos.sector} onChange={manejarCambio}>
        {SECTORES.map((s) => (
          <option key={s.valor} value={s.valor}>
            {s.etiqueta}
          </option>
        ))}
      </select>

      {datos.modalidad === 'busco' ? (
        <>
          <label htmlFor="zona">Zona</label>
          <input id="zona" name="zona" required maxLength={100} value={datos.zona} onChange={manejarCambio} />
        </>
      ) : (
        <div className="fila-fechas">
          <div>
            <label htmlFor="puesto">Puesto</label>
            <input id="puesto" name="puesto" required maxLength={100} value={datos.puesto} onChange={manejarCambio} />
          </div>
          <div>
            <label htmlFor="jornal">Jornal (€/día)</label>
            <input id="jornal" name="jornal" type="number" min="0" required value={datos.jornal} onChange={manejarCambio} />
          </div>
        </div>
      )}

      {datos.modalidad === 'ofrezco' && (
        <small>La oferta caduca sola a los 30 días; podrás republicarla desde su tarjeta cuando llegue el momento.</small>
      )}

      {error && <p className="mensaje-error">{error}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Publicando...' : 'Publicar'}
      </button>
    </form>
  );
}

export default EmpleoFormulario;
