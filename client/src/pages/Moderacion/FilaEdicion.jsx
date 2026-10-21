import { useState } from 'react';
import api from '../../services/api.js';
import VistaContenido from './VistaContenido.jsx';
import Icono from '../../components/Icono.jsx';

// Una fila de la cola de ediciones: una publicación cuyo autor cambió las
// fotos después de publicarla.
//
// A diferencia de un reporte, aquí no hay nada escondido: la publicación
// se sigue viendo en el muro mientras espera. Así que esta cola no es "qué
// hago con esto", es "¿me vale?": el botón normal es dar el visto bueno, y
// para lo contrario ya está la cola de reportes y PATCH /contenido.
function FilaEdicion({ post, onResuelta }) {
  const [historial, setHistorial] = useState(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  // El historial se pide solo cuando se abre: son las versiones viejas de
  // un post, y pedirlas para las veinte filas de la cola serían veinte
  // peticiones para mirar una.
  const abrirHistorial = async () => {
    setVerHistorial(true);
    if (historial) return;

    try {
      const { data } = await api.get(`/posts/${post._id}/ediciones`);
      setHistorial(data);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo cargar el historial.');
    }
  };

  const aprobar = async () => {
    setEnviando(true);
    setError(null);

    try {
      await api.patch(`/moderacion/ediciones/${post._id}`, { nota: nota.trim() || undefined });
      await onResuelta();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo aprobar la edición.');
      setEnviando(false);
    }
  };

  const ocultar = async () => {
    setEnviando(true);
    setError(null);

    try {
      await api.patch('/moderacion/contenido', {
        contenido_tipo: 'post',
        contenido_id: post._id,
        estado_moderacion: 'oculto',
        nota: nota.trim() || undefined,
      });
      await onResuelta();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo ocultar la publicación.');
      setEnviando(false);
    }
  };

  return (
    <article className="tarjeta">
      <div className="hilo-cabecera">
        <strong>Fotos cambiadas al editar</strong>
        <span className="insignia insignia-info">visible mientras se revisa</span>
      </div>

      <div className="tarjeta-meta">
        Editado {post.editado_en ? `el ${new Date(post.editado_en).toLocaleString('es-ES')}` : 'hace poco'}
      </div>

      <VistaContenido contenidoTipo="post" contenido={post} />

      {post.imagenes?.length > 0 && (
        <div className="edicion-imagenes">
          {post.imagenes.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="edicion-imagen">
              <img src={url} alt="" />
            </a>
          ))}
        </div>
      )}

      {!verHistorial ? (
        <button type="button" className="btn btn-plano btn-sm" onClick={abrirHistorial}>
          <Icono nombre="historial" tam={16} /> Ver con qué se publicó
        </button>
      ) : (
        <div className="historial-ediciones">
          {!historial ? (
            <p className="tarjeta-meta">Cargando el historial...</p>
          ) : (
            historial.ediciones.map((version, indice) => (
              <div key={`${version.fecha}-${indice}`} className="historial-version">
                <div className="tarjeta-meta">
                  Versión anterior · desde el {new Date(version.fecha).toLocaleString('es-ES')}
                </div>
                {version.titulo && <strong>{version.titulo}</strong>}
                <p className="contenido-moderado-texto">{version.texto}</p>
                {version.imagenes?.length > 0 && (
                  <div className="edicion-imagenes">
                    {version.imagenes.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="edicion-imagen">
                        <img src={url} alt="" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <label>
        Nota (interna, opcional)
        <input
          value={nota}
          maxLength={500}
          placeholder="Por qué se aprueba, o por qué no"
          onChange={(evento) => setNota(evento.target.value)}
        />
      </label>

      <div className="formulario-reporte-acciones">
        <button type="button" className="btn btn-primario btn-sm" onClick={aprobar} disabled={enviando}>
          {enviando ? 'Guardando...' : 'Dar el visto bueno'}
        </button>
        <button type="button" className="btn btn-contorno btn-sm" onClick={ocultar} disabled={enviando}>
          Ocultar la publicación
        </button>
      </div>

      <p className="tarjeta-meta">
        Al ocultarla, la nota se le envía al autor y podrá apelar; dar el visto bueno no le avisa de nada,
        porque para él nunca dejó de estar publicada.
      </p>

      {error && <p className="mensaje-error">{error}</p>}
    </article>
  );
}

export default FilaEdicion;
