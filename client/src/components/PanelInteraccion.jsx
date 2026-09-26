import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const EMOJI_REACCION = { me_gusta: '👍', me_encanta: '❤️', apoyo: '🙌', triste: '😢' };

// Bloque de reacciones + comentarios, compartido por la tarjeta de
// cualquier seccion (Quejas, Fotos, Eventos, y las que vengan: Turismo,
// Negocios...) porque todas hablan con el mismo router generico de posts
// (/api/posts/:id/reaccion y /comentarios). Cada tarjeta solo pone sus
// propios campos (titulo, categoria/epoca, imagen...) alrededor de esto.
//
// permitirValoracion activa el selector de estrellas al comentar (reseñas
// de Negocios): el resto de secciones no lo pasan, asi que su formulario
// de comentario se queda igual que siempre. Un comentario ya existente con
// valoracion muestra sus estrellas sin depender de esta prop, por si
// alguna vez se reutiliza en otro sitio con datos mixtos.
function PanelInteraccion({ postId, reaccionesIniciales, permitirValoracion = false }) {
  const { usuario } = useAuth();
  const [reacciones, setReacciones] = useState(reaccionesIniciales);
  const [comentarios, setComentarios] = useState(null); // null = todavia no cargados
  const [textoComentario, setTextoComentario] = useState('');
  const [valoracion, setValoracion] = useState(0);

  const reaccionar = async (tipo) => {
    if (!usuario) {
      alert('Inicia sesión para reaccionar.');
      return;
    }
    const { data } = await api.post(`/posts/${postId}/reaccion`, { tipo });
    setReacciones(data.reacciones);
  };

  const alternarComentarios = async () => {
    if (comentarios !== null) {
      setComentarios(null);
      return;
    }
    const { data } = await api.get(`/posts/${postId}/comentarios`);
    setComentarios(data.comentarios);
  };

  const enviarComentario = async (evento) => {
    evento.preventDefault();
    if (!usuario) {
      alert('Inicia sesión para comentar.');
      return;
    }
    if (!textoComentario.trim()) return;

    const { data } = await api.post(`/posts/${postId}/comentarios`, {
      texto: textoComentario,
      valoracion: permitirValoracion && valoracion > 0 ? valoracion : undefined,
    });
    setComentarios([...(comentarios || []), data.comentario]);
    setTextoComentario('');
    setValoracion(0);
  };

  return (
    <>
      <div className="botones-reaccion">
        {Object.entries(EMOJI_REACCION).map(([tipo, emoji]) => (
          <button key={tipo} type="button" onClick={() => reaccionar(tipo)}>
            {emoji} {reacciones?.[tipo] || 0}
          </button>
        ))}
        <button type="button" onClick={alternarComentarios}>
          💬 {comentarios !== null ? 'Ocultar' : permitirValoracion ? 'Ver reseñas' : 'Ver comentarios'}
        </button>
      </div>

      {comentarios !== null && (
        <div className="comentarios">
          {comentarios.length === 0 && <p>Todavía no hay {permitirValoracion ? 'reseñas' : 'comentarios'}.</p>}
          {comentarios.map((c) => (
            <p key={c._id} className="comentario">
              <strong>{c.autor_id?.nombre_usuario}:</strong>{' '}
              {c.valoracion ? <span title={`${c.valoracion} de 5`}>{'★'.repeat(c.valoracion)}{'☆'.repeat(5 - c.valoracion)} </span> : null}
              {c.texto}
            </p>
          ))}
          {usuario ? (
            <form onSubmit={enviarComentario} style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              {permitirValoracion && (
                <span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setValoracion(n)}
                      title={`${n} de 5`}
                      style={{ background: 'none', padding: 2, fontSize: 18 }}
                    >
                      {n <= valoracion ? '★' : '☆'}
                    </button>
                  ))}
                </span>
              )}
              <input
                value={textoComentario}
                onChange={(e) => setTextoComentario(e.target.value)}
                placeholder={permitirValoracion ? 'Escribe tu reseña...' : 'Escribe un comentario...'}
                style={{ flex: 1 }}
              />
              <button type="submit">Enviar</button>
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
