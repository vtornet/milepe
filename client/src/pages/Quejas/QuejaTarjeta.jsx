import PanelInteraccion from '../../components/PanelInteraccion.jsx';

const ETIQUETA_ESTADO = { pendiente: 'Pendiente', en_curso: 'En curso', resuelto: 'Resuelto' };

function QuejaTarjeta({ queja }) {
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

      <PanelInteraccion postId={queja._id} reaccionesIniciales={queja.reacciones} />
    </article>
  );
}

export default QuejaTarjeta;
