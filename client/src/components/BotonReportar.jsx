import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Icono from './Icono.jsx';

// Mismos valores que MOTIVOS_REPORTE en server/src/models/constantes.js.
// Se repiten aquí con su etiqueta en castellano porque el enum del
// servidor no trae texto para enseñar; si se añade un motivo allí, hay que
// añadirlo aquí (GET /api/moderacion/catalogos devuelve la lista viva para
// comprobarlo).
const MOTIVOS = [
  { valor: 'spam', etiqueta: 'Spam o publicidad' },
  { valor: 'acoso', etiqueta: 'Acoso a una persona' },
  { valor: 'contenido_inapropiado', etiqueta: 'Contenido inapropiado' },
  { valor: 'informacion_falsa', etiqueta: 'Información falsa' },
  { valor: 'discurso_odio', etiqueta: 'Discurso de odio' },
  { valor: 'otro', etiqueta: 'Otro motivo' },
];

// Reportar un post o un comentario. Es el mismo componente para los dos
// porque el endpoint es el mismo (contenido_tipo + contenido_id): antes un
// comentario no se podía reportar por separado y había que reportar el post
// entero.
function BotonReportar({ contenidoTipo, contenidoId, compacto = false }) {
  const { usuario } = useAuth();

  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS[0].valor);
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  // Escape cierra la ventana, como cualquier diálogo.
  useEffect(() => {
    if (!abierto) return undefined;
    const alPulsar = (evento) => evento.key === 'Escape' && setAbierto(false);
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [abierto]);

  if (!usuario) return null;

  const enviar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    try {
      const { data } = await api.post('/moderacion/reportes', {
        contenido_tipo: contenidoTipo,
        contenido_id: contenidoId,
        motivo,
        detalle: detalle.trim() || undefined,
      });
      setAbierto(false);
      setResultado(
        data.contenido_oculto
          ? 'Gracias. El contenido se ha ocultado y queda pendiente de revisión.'
          : 'Gracias. Un moderador lo revisará.',
      );
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo enviar el reporte.');
    } finally {
      setEnviando(false);
    }
  };

  if (resultado) {
    return (
      <span className="tarjeta-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Icono nombre="comprobado" tam={14} />
        {resultado}
      </span>
    );
  }

  return (
    <>
      {/* Un emoji 🚩 en medio de un juego de iconos de trazo canta, y
          ademas sale rojo y llama mas la atencion que el propio contenido.
          Con el icono hereda el color de su contexto y se queda donde
          tiene que estar: disponible, pero discreto. */}
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className={compacto ? 'boton-reportar-compacto' : 'btn btn-plano btn-sm'}
        title="Reportar a los moderadores"
      >
        <Icono nombre="bandera" tam={compacto ? 15 : 17} />
        {!compacto && ' Reportar'}
      </button>

      {/* En un portal sobre <body>: el botón vive en la fila de la cabecera
          de una publicación, en el pie de un comentario o en una burbuja de
          mensaje, y pintado ahí el formulario quedaba aplastado dentro de
          esa fila (en el móvil, descuadrado). Hoja inferior en el móvil,
          diálogo centrado en pantallas anchas. */}
      {abierto &&
        createPortal(
          <div className="velo velo-dialogo" onClick={() => setAbierto(false)} role="presentation">
            <div
              className="hoja hoja-dialogo"
              onClick={(evento) => evento.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-reporte"
            >
              <div className="hoja-asa" />
              <h2 id="titulo-reporte" className="hoja-titulo">
                <Icono nombre="bandera" tam={18} /> Reportar a los moderadores
              </h2>
              <form onSubmit={enviar} className="formulario-reporte">
                <label htmlFor="reporte-motivo">Motivo</label>
                <select id="reporte-motivo" value={motivo} onChange={(evento) => setMotivo(evento.target.value)}>
                  {MOTIVOS.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.etiqueta}
                    </option>
                  ))}
                </select>

                <label htmlFor="reporte-detalle">Detalle (opcional)</label>
                <textarea
                  id="reporte-detalle"
                  rows={3}
                  value={detalle}
                  maxLength={500}
                  placeholder="Algo más que deba saber el moderador"
                  onChange={(evento) => setDetalle(evento.target.value)}
                />

                {error && <p className="mensaje-error">{error}</p>}

                <div className="formulario-reporte-acciones">
                  <button type="button" className="btn btn-plano" onClick={() => setAbierto(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primario" disabled={enviando}>
                    {enviando ? 'Enviando…' : 'Enviar reporte'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default BotonReportar;
