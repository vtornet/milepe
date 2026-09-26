import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const EMOJI_REACCION = { me_gusta: '👍', me_encanta: '❤️', apoyo: '🙌', triste: '😢' };

// Bloque de reacciones + comentarios, compartido por la tarjeta de
// cualquier seccion (Quejas, Fotos, y las que vengan: Eventos, Turismo,
// Negocios...) porque todas hablan con el mismo router generico de posts
// (/api/posts/:id/reaccion y /comentarios). Cada tarjeta solo pone sus
// propios campos (titulo, categoria/epoca, imagen...) alrededor de esto.
function PanelInteraccion({ postId, reaccionesIniciales }) {
  const { usuario } = useAuth();
  const [reacciones, setReacciones] = useState(reaccionesIniciales);
  const [comentarios, setComentarios] = useState(null); // null = todavia no cargados
  const [textoComentario, setTextoComentario] = useState('');

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

    const { data } = await api.post(`/posts/${postId}/comentarios`, { texto: textoComentario });
    setComentarios([...(comentarios || []), data.comentario]);
    setTextoComentario('');
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
          💬 {comentarios !== null ? 'Ocultar' : 'Ver comentarios'}
        </button>
      </div>

      {comentarios !== null && (
        <div className="comentarios">
          {comentarios.length === 0 && <p>Sin comentarios todavía.</p>}
          {comentarios.map((c) => (
            <p key={c._id} className="comentario">
              <strong>{c.autor_id?.nombre_usuario}:</strong> {c.texto}
            </p>
          ))}
          {usuario ? (
            <form onSubmit={enviarComentario} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                value={textoComentario}
                onChange={(e) => setTextoComentario(e.target.value)}
                placeholder="Escribe un comentario..."
                style={{ flex: 1 }}
              />
              <button type="submit">Enviar</button>
            </form>
          ) : (
            <p className="tarjeta-meta">
              <Link to="/login">Inicia sesión</Link> para comentar.
            </p>
          )}
        </div>
      )}
    </>
  );
}

export default PanelInteraccion;
