import { useState } from 'react';
import api from '../../services/api.js';
import SelectorUbicacion from '../Quejas/SelectorUbicacion.jsx';
import { SECCIONES_TURISMO } from './seccionesTurismo.js';

const datosDe = (recurso, seccion) => ({
  seccion: recurso?.seccion || seccion,
  titulo: recurso?.titulo || '',
  descripcion: recurso?.descripcion || '',
  direccion: recurso?.direccion || '',
  telefono: recurso?.telefono || '',
  web: recurso?.web || '',
});

// Formulario de administrador: crea un recurso o, si llega `recurso`, lo
// edita. Las imagenes ya subidas se conservan (y se pueden quitar); las
// que se elijan ahora se suben a Cloudinary antes de guardar.
function TurismoFormulario({ seccion, recurso, onGuardado, onCancelar }) {
  const editando = Boolean(recurso);
  const [datos, setDatos] = useState(datosDe(recurso, seccion));
  const [imagenes, setImagenes] = useState(recurso?.imagenes || []);
  // Creditos de las imagenes que ya tenia (Wikimedia): se conservan mientras
  // la imagen siga, y se descartan con ella.
  const [creditos] = useState(recurso?.creditos || []);
  const [archivos, setArchivos] = useState([]);
  const [ubicacion, setUbicacion] = useState(recurso?.ubicacion || null);
  const [marcarUbicacion, setMarcarUbicacion] = useState(Boolean(recurso?.ubicacion));
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
      let todasLasImagenes = imagenes;

      if (archivos.length > 0) {
        const formData = new FormData();
        archivos.forEach((archivo) => formData.append('imagenes', archivo));
        const { data: subida } = await api.post('/subidas/imagenes', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        todasLasImagenes = [...imagenes, ...subida.imagenes];
      }

      // Los campos de texto vacios se mandan como null: borran lo que
      // hubiera, en vez de guardar una cadena vacia.
      const cuerpo = {
        ...datos,
        direccion: datos.direccion.trim() || null,
        telefono: datos.telefono.trim() || null,
        web: datos.web.trim() || null,
        imagenes: todasLasImagenes,
        creditos: creditos.filter((c) => todasLasImagenes.includes(c.imagen)),
        ubicacion: marcarUbicacion && ubicacion ? ubicacion : null,
      };

      const { data } = editando
        ? await api.patch(`/turismo/${recurso._id}`, cuerpo)
        : await api.post('/turismo', cuerpo);

      onGuardado(data.recurso);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo guardar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="tarjeta-formulario" onSubmit={manejarEnvio}>
      <h2>{editando ? 'Editar recurso' : 'Nuevo recurso'}</h2>

      <label htmlFor="seccion">Sección</label>
      <select id="seccion" name="seccion" value={datos.seccion} onChange={manejarCambio}>
        {SECCIONES_TURISMO.map((s) => (
          <option key={s.valor} value={s.valor}>
            {s.etiqueta}
          </option>
        ))}
      </select>

      <label htmlFor="titulo">Título</label>
      <input id="titulo" name="titulo" required maxLength={120} value={datos.titulo} onChange={manejarCambio} />

      <label htmlFor="descripcion">Descripción</label>
      <textarea
        id="descripcion"
        name="descripcion"
        rows={5}
        required
        maxLength={5000}
        value={datos.descripcion}
        onChange={manejarCambio}
      />

      <label htmlFor="direccion">Dirección (opcional)</label>
      <input id="direccion" name="direccion" maxLength={200} value={datos.direccion} onChange={manejarCambio} />

      <label htmlFor="telefono">Teléfono (opcional)</label>
      <input id="telefono" name="telefono" maxLength={30} value={datos.telefono} onChange={manejarCambio} />

      <label htmlFor="web">Web (opcional)</label>
      <input id="web" name="web" type="url" maxLength={300} value={datos.web} onChange={manejarCambio} />

      {imagenes.length > 0 && (
        <>
          <label>Imágenes actuales</label>
          <div className="recurso-imagenes">
            {imagenes.map((url) => (
              <figure key={url} className="recurso-imagen-editable">
                <img src={url} alt="" />
                <button
                  type="button"
                  className="btn btn-plano btn-sm"
                  onClick={() => setImagenes(imagenes.filter((i) => i !== url))}
                >
                  Quitar
                </button>
              </figure>
            ))}
          </div>
        </>
      )}

      <label htmlFor="archivos">Añadir imágenes (hasta {Math.max(0, 10 - imagenes.length)})</label>
      <input
        id="archivos"
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => setArchivos(Array.from(e.target.files))}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
        <input
          type="checkbox"
          checked={marcarUbicacion}
          onChange={(e) => setMarcarUbicacion(e.target.checked)}
          style={{ width: 'auto' }}
        />
        Marcar ubicación en el mapa
      </label>
      {marcarUbicacion && <SelectorUbicacion value={ubicacion} onChange={setUbicacion} />}

      {error && <p className="mensaje-error">{error}</p>}

      <div className="acciones-formulario">
        <button type="submit" className="btn btn-primario" disabled={enviando}>
          {enviando ? 'Guardando...' : 'Guardar'}
        </button>
        <button type="button" className="btn btn-contorno" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default TurismoFormulario;
