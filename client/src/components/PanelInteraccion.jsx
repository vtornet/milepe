import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from './Avatar.jsx';
import Icono from './Icono.jsx';
import BotonReportar from './BotonReportar.jsx';
import { haceCuanto } from '../utils/fechas.js';

// Mismos valores que TIPOS_REACCION en server/src/models/constantes.js.
// 'apoyo' hace también de "a mí me pasa lo mismo" en una queja, de ahí que
// la etiqueta no sea solo el nombre del emoji.
const REACCIONES = [
  { tipo: 'me_gusta', emoji: '👍', etiqueta: 'Me gusta' },
  { tipo: 'me_encanta', emoji: '❤️', etiqueta: 'Me encanta' },
  { tipo: 'apoyo', emoji: '🙌', etiqueta: 'Te apoyo' },
  { tipo: 'triste', emoji: '😢', etiqueta: 'Qué pena' },
];

// Bloque de reacciones + comentarios, compartido por todas las secciones
// porque todas hablan con el mismo router genérico de posts
// (/api/posts/:id/reaccion y /comentarios).
//
// permitirValoracion activa el selector de estrellas al comentar (reseñas
// de Negocios); el resto de secciones no lo pasan. Un comentario que ya
// tiene valoración muestra sus estrellas sin depender de esa prop.
function PanelInteraccion({ postId, reaccionesIniciales, numComentarios = 0, permitirValoracion = false }) {
  const { usuario } = useAuth();

  const [reacciones, setReacciones] = useState(reaccionesIniciales || {});
  const [miReaccion, setMiReaccion] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const [comentarios, setComentarios] = useState(null); // null = todavía no cargados
  const [cargandoComentarios, setCargandoComentarios] = useState(false);
  const [textoComentario, setTextoComentario] = useState('');
  const [valoracion, setValoracion] = useState(0);
  const [enviando, setEnviando] = useState(false);

  // Un alert() del navegador para "inicia sesión" es lo más brusco que
  // puede hacer una interfaz: bloquea la página y se ve como un error del
  // sistema. Ahora el aviso sale dentro de la propia tarjeta.
  const [aviso, setAviso] = useState(null);

  const total = REACCIONES.reduce((suma, r) => suma + (reacciones?.[r.tipo] || 0), 0);
  const presentes = REACCIONES.filter((r) => (reacciones?.[r.tipo] || 0) > 0);
  const cuantosComentarios = comentarios?.length ?? numComentarios;

  const exigirSesion = () => {
    if (usuario) return true;
    setAviso('Inicia sesión para participar.');
    return false;
  };

  const reaccionar = async (tipo) => {
    setMenuAbierto(false);
    if (!exigirSesion()) return;

    try {
      const { data } = await api.post(`/posts/${postId}/reaccion`, { tipo });
      setReacciones(data.reacciones);
      // El backend alterna: repetir la misma reacción la quita.
      setMiReaccion((anterior) => (anterior === tipo ? null : tipo));
      setAviso(null);
    } catch (err) {
      setAviso(err.response?.data?.mensaje || 'No se pudo registrar tu reacción.');
    }
  };

  const alternarComentarios = async () => {
    if (comentarios !== null) {
      setComentarios(null);
      return;
    }

    setCargandoComentarios(true);
    try {
      const { data } = await api.get(`/posts/${postId}/comentarios`);
      setComentarios(data.comentarios);
    } catch {
      setAviso('No se pudieron cargar los comentarios.');
    } finally {
      setCargandoComentarios(false);
    }
  };

  const enviarComentario = async (evento) => {
    evento.preventDefault();
    if (!exigirSesion() || !textoComentario.trim() || enviando) return;

    setEnviando(true);
    try {
      const { data } = await api.post(`/posts/${postId}/comentarios`, {
        texto: textoComentario,
        valoracion: permitirValoracion && valoracion > 0 ? valoracion : undefined,
      });
      setComentarios([...(comentarios || []), data.comentario]);
      setTextoComentario('');
      setValoracion(0);
      setAviso(null);
    } catch (err) {
      setAviso(err.response?.data?.mensaje || 'No se pudo publicar tu comentario.');
    } finally {
      setEnviando(false);
    }
  };

  const palabraComentario = permitirValoracion ? 'reseña' : 'comentario';

  return (
    <>
      {/* Resumen por encima de la barra, como en cualquier red social: los
          emojis apilados y el total. Si nadie ha reaccionado no se pinta
          nada, para no dejar un "0" que solo subraya el vacío. */}
      {total > 0 && (
        <div className="resumen-reacciones">
          <span className="resumen-reacciones-emojis">
            {presentes.map((r) => (
              <span key={r.tipo} title={r.etiqueta}>
                {r.emoji}
              </span>
            ))}
          </span>
          <span style={{ marginLeft: 8 }}>{total}</span>
        </div>
      )}

      <div className="acciones">
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={miReaccion ? 'accion activa' : 'accion'}
            onClick={() => (usuario ? setMenuAbierto(!menuAbierto) : exigirSesion())}
            aria-expanded={menuAbierto}
          >
            {miReaccion ? (
              <span className="accion-emoji">{REACCIONES.find((r) => r.tipo === miReaccion)?.emoji}</span>
            ) : (
              <Icono nombre="corazon" tam={18} />
            )}
            {miReaccion ? REACCIONES.find((r) => r.tipo === miReaccion)?.etiqueta : 'Reaccionar'}
          </button>

          {menuAbierto && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 1 }} onClick={() => setMenuAbierto(false)} />
              {/* Las cuatro reacciones a la vez en vez de un solo "me
                  gusta" con menú escondido: son cuatro y caben, y 'apoyo'
                  es la que da sentido a una queja. */}
              <div
                className="reacciones-menu"
                style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 2 }}
              >
                {REACCIONES.map((r) => (
                  <button key={r.tipo} type="button" title={r.etiqueta} onClick={() => reaccionar(r.tipo)}>
                    {r.emoji}
                    <span className="solo-lectores">{r.etiqueta}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button type="button" className="accion" onClick={alternarComentarios}>
          <Icono nombre="comentario" tam={18} />
          {cuantosComentarios > 0 && <span className="accion-cuenta">{cuantosComentarios}</span>}
          {permitirValoracion ? 'Reseñas' : 'Comentar'}
        </button>
      </div>

      {aviso && (
        <p className="tarjeta-meta" style={{ padding: '0 var(--e-4) var(--e-3)' }}>
          {aviso}{' '}
          {!usuario && (
            <Link to="/login">Entrar</Link>
          )}
        </p>
      )}

      {(comentarios !== null || cargandoComentarios) && (
        <div className="comentarios">
          {cargandoComentarios && <p className="tarjeta-meta">Cargando {palabraComentario}s...</p>}

          {comentarios?.length === 0 && (
            <p className="tarjeta-meta">
              Todavía no hay {palabraComentario}s. {usuario ? 'Escribe la primera.' : ''}
            </p>
          )}

          {comentarios?.map((c) => (
            <div key={c._id} className="comentario">
              <Avatar usuario={c.autor_id} tamano="xs" />
              <div className="comentario-burbuja">
                <span className="comentario-autor">{c.autor_id?.nombre_usuario || 'Vecino'}</span>
                {c.valoracion > 0 && (
                  <span className="estrellas" title={`${c.valoracion} de 5`}>
                    {' '}
                    {'★'.repeat(c.valoracion)}
                    {'☆'.repeat(5 - c.valoracion)}
                  </span>
                )}
                <p className="comentario-texto">{c.texto}</p>
                <div className="comentario-pie">
                  <time>{haceCuanto(c.fecha_creacion)}</time>
                  <BotonReportar contenidoTipo="comentario" contenidoId={c._id} compacto />
                </div>
              </div>
            </div>
          ))}

          {usuario ? (
            <form onSubmit={enviarComentario} className="formulario-comentario">
              <Avatar usuario={usuario} tamano="xs" />

              {permitirValoracion && (
                <span className="selector-estrellas">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setValoracion(n)} title={`${n} de 5`}>
                      {n <= valoracion ? '★' : '☆'}
                      <span className="solo-lectores">{`Puntuar con ${n}`}</span>
                    </button>
                  ))}
                </span>
              )}

              <input
                value={textoComentario}
                onChange={(evento) => setTextoComentario(evento.target.value)}
                placeholder={`Escribe tu ${palabraComentario}...`}
                aria-label={`Escribe tu ${palabraComentario}`}
              />

              <button
                type="button"
                className="btn-icono"
                onClick={enviarComentario}
                disabled={enviando || !textoComentario.trim()}
                title="Enviar"
              >
                <Icono nombre="enviar" />
                <span className="solo-lectores">Enviar</span>
              </button>
            </form>
          ) : (
            <p className="tarjeta-meta">
              <Link to="/login">Inicia sesión</Link> para {permitirValoracion ? 'reseñar' : 'comentar'}.
            </p>
          )}
        </div>
      )}
    </>
  );
}

export default PanelInteraccion;
