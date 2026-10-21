import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useReacciones } from '../context/ReaccionesContext.jsx';
import Avatar from './Avatar.jsx';
import Icono from './Icono.jsx';
import BotonReportar from './BotonReportar.jsx';
import SelectorReaccion from './SelectorReaccion.jsx';
import { contarReacciones, reaccionesPresentes } from '../utils/reacciones.js';
import { haceCuanto } from '../utils/fechas.js';

// Los emojis que ya tiene algo, con el total al lado. Si nadie ha
// reaccionado no se pinta nada: un "0" solo subraya el vacío.
function ResumenReacciones({ resumen, clase = 'resumen-reacciones' }) {
  const total = contarReacciones(resumen);
  if (total === 0) return null;

  return (
    <div className={clase}>
      <span className="resumen-reacciones-emojis">
        {reaccionesPresentes(resumen).map((r) => (
          <span key={r.tipo} title={`${r.etiqueta}: ${resumen[r.tipo]}`}>
            {r.emoji}
          </span>
        ))}
      </span>
      <span>{total}</span>
    </div>
  );
}

// Bloque de reacciones + comentarios, compartido por todas las secciones
// porque todas hablan con el mismo router genérico de posts
// (/api/posts/:id/reaccion y /comentarios).
//
// permitirValoracion activa el selector de estrellas al comentar (reseñas
// de Negocios); el resto de secciones no lo pasan. Un comentario que ya
// tiene valoración muestra sus estrellas sin depender de esa prop.
function PanelInteraccion({ postId, reaccionesIniciales, numComentarios = 0, permitirValoracion = false }) {
  const { usuario } = useAuth();
  const { mias, anotar } = useReacciones();

  const [reacciones, setReacciones] = useState(reaccionesIniciales || {});

  const [comentarios, setComentarios] = useState(null); // null = todavía no cargados
  const [cargandoComentarios, setCargandoComentarios] = useState(false);
  const [textoComentario, setTextoComentario] = useState('');
  const [valoracion, setValoracion] = useState(0);
  const [enviando, setEnviando] = useState(false);

  // Un alert() del navegador para "inicia sesión" es lo más brusco que
  // puede hacer una interfaz: bloquea la página y se ve como un error del
  // sistema. Ahora el aviso sale dentro de la propia tarjeta.
  const [aviso, setAviso] = useState(null);

  const cuantosComentarios = comentarios?.length ?? numComentarios;

  const exigirSesion = () => {
    if (usuario) return true;
    setAviso('Inicia sesión para participar.');
    return false;
  };

  const reaccionar = async (tipo) => {
    if (!exigirSesion()) return;

    try {
      const { data } = await api.post(`/posts/${postId}/reaccion`, { tipo });
      setReacciones(data.reacciones);
      // El servidor alterna: repetir la misma la quita, otra distinta la
      // cambia. Devuelve el tipo que queda (null si se ha quitado), que es
      // lo que se guarda, en vez de darlo por hecho aquí.
      anotar('posts', postId, data.tipo);
      setAviso(null);
    } catch (err) {
      setAviso(err.response?.data?.mensaje || 'No se pudo registrar tu reacción.');
    }
  };

  const reaccionarAComentario = async (comentarioId, tipo) => {
    if (!exigirSesion()) return;

    try {
      const { data } = await api.post(`/posts/${postId}/comentarios/reaccion`, {
        tipo,
        comentario_id: comentarioId,
      });
      setComentarios((lista) =>
        (lista || []).map((c) => (c._id === comentarioId ? { ...c, reacciones_resumen: data.reacciones } : c)),
      );
      anotar('comentarios', comentarioId, data.tipo);
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
      {/* Por encima de la barra, como en cualquier red social. */}
      <ResumenReacciones resumen={reacciones} />

      <div className="acciones">
        <SelectorReaccion valor={mias.posts[postId] || null} onElegir={reaccionar} />

        <button type="button" className="accion" onClick={alternarComentarios}>
          <Icono nombre="comentario" tam={18} />
          {cuantosComentarios > 0 && <span className="accion-cuenta">{cuantosComentarios}</span>}
          {permitirValoracion ? 'Reseñas' : 'Comentar'}
        </button>
      </div>

      {aviso && (
        <p className="tarjeta-meta" style={{ padding: '0 var(--e-4) var(--e-3)' }}>
          {aviso} {!usuario && <Link to="/login">Entrar</Link>}
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
                  {/* Las mismas siete reacciones que en una publicación: el
                      endpoint ya existía, pero no había forma de usarlo
                      desde la pantalla. */}
                  <SelectorReaccion
                    compacto
                    valor={mias.comentarios[c._id] || null}
                    onElegir={(tipo) => reaccionarAComentario(c._id, tipo)}
                  />
                  <ResumenReacciones resumen={c.reacciones_resumen} clase="resumen-reacciones-mini" />
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
