import { useState } from 'react';
import api from '../../services/api.js';
import Icono from '../../components/Icono.jsx';
import { redimensionada } from '../../utils/imagenes.js';

// Dos fotos del mismo autor y licencia se citan una sola vez.
const creditosUnicos = (creditos = []) => {
  const vistos = new Set();
  return creditos.filter((c) => {
    const clave = `${c.autor}|${c.licencia}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
};

const enlaceTelefono = (telefono) => `tel:${telefono.replace(/[^\d+]/g, '')}`;

// Enlace al mapa de OpenStreetMap con un marcador en el punto.
const enlaceMapa = ({ lat, lng }) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

// Ficha informativa de un recurso. No es un Post: sin autor, sin
// reacciones ni comentarios. Los botones de edicion solo se pintan si el
// padre pasa `onEditar` (es decir, si quien mira es admin).
function RecursoTarjeta({ recurso, onEditar, onCambiado, onEliminado }) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const alternarActivo = async () => {
    setError(null);
    setOcupado(true);
    try {
      const { data } = await api.patch(`/turismo/${recurso._id}`, { activo: !recurso.activo });
      onCambiado(data.recurso);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo cambiar la visibilidad');
    } finally {
      setOcupado(false);
    }
  };

  const eliminar = async () => {
    setError(null);
    setOcupado(true);
    try {
      await api.delete(`/turismo/${recurso._id}`);
      onEliminado(recurso._id);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo eliminar');
      setOcupado(false);
    }
  };

  return (
    <article className={`tarjeta recurso-turismo${recurso.activo ? '' : ' recurso-oculto'}`}>
      {recurso.imagenes?.length > 0 && (
        <div className="recurso-galeria">
          <img className="recurso-portada" src={redimensionada(recurso.imagenes[0], 900)} alt={recurso.titulo} loading="lazy" />
          {recurso.imagenes.length > 1 && (
            <div className="recurso-miniaturas">
              {recurso.imagenes.slice(1).map((url) => (
                <img key={url} src={redimensionada(url, 400)} alt="" loading="lazy" />
              ))}
            </div>
          )}
          {recurso.creditos?.length > 0 && (
            <p className="recurso-creditos">
              {creditosUnicos(recurso.creditos).map((c, i) => (
                <span key={c.imagen}>
                  {i > 0 && ' · '}
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer">
                      Foto: {c.autor || 'autor desconocido'}
                    </a>
                  ) : (
                    <>Foto: {c.autor || 'autor desconocido'}</>
                  )}
                  {c.licencia && ` (${c.licencia})`}
                </span>
              ))}
            </p>
          )}
        </div>
      )}

      <div className="recurso-cabecera">
        <h2>{recurso.titulo}</h2>
        {!recurso.activo && <span className="insignia insignia-aviso">Oculto</span>}
      </div>

      <p className="recurso-descripcion">{recurso.descripcion}</p>

      <div className="recurso-datos">
        {recurso.direccion && (
          <span className="tarjeta-meta">
            <Icono nombre="ubicacion" tam={14} /> {recurso.direccion}
          </span>
        )}
        {recurso.telefono && (
          <a className="tarjeta-meta" href={enlaceTelefono(recurso.telefono)}>
            <Icono nombre="telefono" tam={14} /> {recurso.telefono}
          </a>
        )}
        {recurso.web && (
          <a className="tarjeta-meta" href={recurso.web} target="_blank" rel="noreferrer">
            <Icono nombre="enlace" tam={14} /> Web
          </a>
        )}
        {recurso.ubicacion && (
          <a className="tarjeta-meta" href={enlaceMapa(recurso.ubicacion)} target="_blank" rel="noreferrer">
            <Icono nombre="ubicacion" tam={14} /> Ver en el mapa
          </a>
        )}
        {recurso.fuente && (
          <a className="tarjeta-meta" href={recurso.fuente} target="_blank" rel="noreferrer">
            <Icono nombre="enlace" tam={14} /> Más información
          </a>
        )}
      </div>

      {onEditar && (
        <div className="recurso-admin">
          {confirmando ? (
            <>
              <span className="tarjeta-meta">¿Eliminar para siempre?</span>
              <button type="button" className="btn btn-peligro btn-sm" disabled={ocupado} onClick={eliminar}>
                Sí, eliminar
              </button>
              <button type="button" className="btn btn-contorno btn-sm" onClick={() => setConfirmando(false)}>
                No
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-contorno btn-sm" onClick={() => onEditar(recurso)}>
                <Icono nombre="lapiz" tam={14} /> Editar
              </button>
              <button type="button" className="btn btn-contorno btn-sm" disabled={ocupado} onClick={alternarActivo}>
                {recurso.activo ? 'Ocultar' : 'Mostrar'}
              </button>
              <button type="button" className="btn btn-plano btn-sm" onClick={() => setConfirmando(true)}>
                Eliminar
              </button>
            </>
          )}
        </div>
      )}

      {error && <p className="mensaje-error">{error}</p>}
    </article>
  );
}

export default RecursoTarjeta;
