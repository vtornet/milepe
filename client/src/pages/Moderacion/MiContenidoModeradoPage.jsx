import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api.js';
import VistaContenido from './VistaContenido.jsx';

// Lo que el vecino sancionado ve de lo suyo, y desde donde apela. Existe
// porque el Muro y las secciones solo muestran lo publicado: sin esta
// página, un post oculto simplemente desaparece y su autor no tendría ni
// cómo enterarse del motivo ni desde dónde reclamar.
//
// El motivo de la decisión sí se le enseña; quién la tomó, no (el servidor
// no lo devuelve): saber qué moderador fue no le ayuda a defenderse y sí
// invita a tomárselo con la persona.
function MiContenidoModeradoPage() {
  const [fichas, setFichas] = useState(null);
  const [error, setError] = useState(null);

  const [apelando, setApelando] = useState(null); // contenido_id
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorApelacion, setErrorApelacion] = useState(null);

  const cargar = useCallback(async () => {
    const { data } = await api.get('/moderacion/mi-contenido-moderado');
    setFichas(data.contenido);
  }, []);

  useEffect(() => {
    cargar().catch(() => setError('No se pudo cargar tu contenido.'));
  }, [cargar]);

  const apelar = async (evento, ficha) => {
    evento.preventDefault();

    if (!texto.trim()) {
      setErrorApelacion('Explica por qué crees que la decisión es equivocada.');
      return;
    }

    setEnviando(true);
    setErrorApelacion(null);

    try {
      await api.post('/moderacion/apelaciones', {
        contenido_tipo: ficha.contenido_tipo,
        contenido_id: ficha.contenido._id,
        texto,
      });
      setApelando(null);
      setTexto('');
      await cargar();
    } catch (err) {
      setErrorApelacion(err.response?.data?.mensaje || 'No se pudo enviar la apelación.');
    } finally {
      setEnviando(false);
    }
  };

  if (error) return <p className="mensaje-error">{error}</p>;
  if (fichas === null) return <p>Cargando...</p>;

  return (
    <section>
      <h1>Mi contenido moderado</h1>

      {fichas.length === 0 && (
        <p>No tienes nada oculto ni eliminado. Todo lo que has publicado está visible.</p>
      )}

      {fichas.map((ficha) => (
        <article key={ficha.contenido._id} className="tarjeta">
          <VistaContenido contenidoTipo={ficha.contenido_tipo} contenido={ficha.contenido} />

          {ficha.ultima_accion ? (
            <p className="tarjeta-meta">
              Motivo: {ficha.ultima_accion.nota || 'no se indicó ninguno'} ·{' '}
              {new Date(ficha.ultima_accion.fecha_creacion).toLocaleString('es-ES')}
            </p>
          ) : (
            <p className="tarjeta-meta">No consta el motivo de esta decisión.</p>
          )}

          {ficha.apelacion ? (
            <div className="tarjeta-meta">
              Apelación <span className="insignia">{ficha.apelacion.estado}</span>
              {ficha.apelacion.respuesta && <> · Respuesta: {ficha.apelacion.respuesta}</>}
              {ficha.apelacion.estado === 'pendiente' && ' · pendiente de revisión por un administrador'}
            </div>
          ) : apelando === String(ficha.contenido._id) ? (
            <form onSubmit={(evento) => apelar(evento, ficha)} className="formulario-resolucion">
              <label>
                Por qué apelas
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={texto}
                  onChange={(evento) => setTexto(evento.target.value)}
                  placeholder="Explica por qué crees que la decisión es equivocada"
                />
              </label>

              <div className="formulario-reporte-acciones">
                <button type="submit" disabled={enviando}>
                  {enviando ? 'Enviando...' : 'Enviar apelación'}
                </button>
                <button type="button" onClick={() => setApelando(null)}>
                  Cancelar
                </button>
              </div>

              <p className="tarjeta-meta">
                Solo se puede apelar una vez por publicación: la resolución es definitiva.
              </p>

              {errorApelacion && <p className="mensaje-error">{errorApelacion}</p>}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setApelando(String(ficha.contenido._id));
                setTexto('');
                setErrorApelacion(null);
              }}
            >
              Apelar esta decisión
            </button>
          )}
        </article>
      ))}
    </section>
  );
}

export default MiContenidoModeradoPage;
