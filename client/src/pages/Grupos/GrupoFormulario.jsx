import { useState } from 'react';
import api from '../../services/api.js';
import { CATEGORIAS_GRUPO } from './categoriasGrupo.js';

const INICIAL = { nombre: '', descripcion: '', categoria: 'barrio' };

function GrupoFormulario({ grupo, onGuardado, onCancelar }) {
  const [datos, setDatos] = useState(
    grupo ? { nombre: grupo.nombre, descripcion: grupo.descripcion, categoria: grupo.categoria } : INICIAL,
  );
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (e) => setDatos({ ...datos, [e.target.name]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const { data } = grupo ? await api.patch(`/grupos/${grupo._id}`, datos) : await api.post('/grupos', datos);
      onGuardado(data.grupo);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo guardar el grupo');
      setEnviando(false);
    }
  };

  return (
    <form className="tarjeta" onSubmit={enviar}>
      <h2>{grupo ? 'Editar el grupo' : 'Nuevo grupo'}</h2>

      <label htmlFor="grupo-nombre">Nombre</label>
      <input id="grupo-nombre" name="nombre" required minLength={3} maxLength={80} value={datos.nombre} onChange={cambiar} />

      <label htmlFor="grupo-categoria">Tipo</label>
      <select id="grupo-categoria" name="categoria" value={datos.categoria} onChange={cambiar}>
        {Object.entries(CATEGORIAS_GRUPO).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </select>

      <label htmlFor="grupo-descripcion">De qué va</label>
      <textarea id="grupo-descripcion" name="descripcion" rows={3} required maxLength={1000} value={datos.descripcion} onChange={cambiar} />

      {!grupo && (
        <p className="tarjeta-meta">
          El grupo es público: cualquiera puede leerlo y unirse. Solo los miembros publican en él.
        </p>
      )}

      {error && <p className="mensaje-error">{error}</p>}
      <div className="fila" style={{ gap: 'var(--e-2)' }}>
        <button type="submit" disabled={enviando}>
          {enviando ? 'Guardando...' : grupo ? 'Guardar' : 'Crear grupo'}
        </button>
        {onCancelar && (
          <button type="button" className="btn btn-contorno" onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

export default GrupoFormulario;
