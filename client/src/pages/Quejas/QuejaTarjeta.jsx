import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const EMOJI_REACCION = { me_gusta: '👍', me_encanta: '❤️', apoyo: '🙌', triste: '😢' };
const ETIQUETA_ESTADO = { pendiente: 'Pendiente', en_curso: 'En curso', resuelto: 'Resuelto' };

function QuejaTarjeta({ queja }) {
  const { usuario } = useAuth();
  const [reacciones, setReacciones] = useState(queja.reacciones);
  const [comentarios, setComentarios] = useState(null); // null = todavia no cargados
  const [textoComentario, setTextoComentario] = useState('');
  const [cargandoComentarios, setCargandoComentarios] = useState(false);

  const reaccionar = async (tipo) => {
    if (!usuario) {
      alert('Inicia sesión para reaccionar.');
      return;
    }
    const { data } = await api.post(`/posts/${queja._id}/reaccion`, { tipo });
    setReacciones(data.reacciones);
  };

  const cargarComentarios = async () => {
    if (comentarios !== null) {
      setComentarios(null); // segundo clic: ocultar
      return;
    }
    setCargandoComentarios(true);
    const { data } = await api.get(`/posts/${queja._id}/comentarios`);
    setComentarios(data.comentarios);
    setCargandoComentarios(false);
  };

  const enviarComentario = async (evento) => {
    evento.preventDefault();
    if (!usuario) {
      alert('Inicia sesión para comentar.');
      return;
    }
    if (!textoComentario.trim()) return;

    const { data } = await api.post(`/posts/${queja._id}/comentarios`, { texto: textoComentario });
    setComentarios([...(comentarios || []), data.comentario]);
    setTextoComentario('');
  };

  return (
    <article className="tarjeta">
      <span className="insignia">{queja.categoria}</span>{' '}
      <span className="insignia">{ETIQUETA_ESTADO[queja.estado] || queja.estado}</span>
      <h2>{queja.titulo}</h2>
      <p>{queja.contenido}</p>
      {queja.direccion_aproximada && <p className="tarjeta-meta">📍 {queja.direccion_aproximada}</p>}
      <div className="tarjeta-meta">
        Por {queja.autor?.nombre_usuario || 'alguien'} · {new Date(queja.fecha_creacion).toLocaleString('es-ES')} ·{' '}
        {queja.num_comentarios} comentarios
      </div>

      <div className="botones-reaccion">
        {Object.entries(EMOJI_REACCION).map(([tipo, emoji]) => (
          <button key={tipo} type="button" onClick={() => reaccionar(tipo)}>
            {emoji} {reacciones?.[tipo] || 0}
          </button>
        ))}
        <button type="button" onClick={cargarComentarios}>
          💬 {comentarios !== null ? 'Ocultar' : 'Ver comentarios'}
        </button>
      </div>

      {comentarios !== null && (
        <div className="comentarios">
          {cargandoComentarios && <p>Cargando...</p>}
          {!cargandoComentarios && comentarios.length === 0 && <p>Sin comentarios todavía.</p>}
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
    </article>
  );
}

export default QuejaTarjeta;
