import PanelInteraccion from '../../components/PanelInteraccion.jsx';

const ETIQUETA_CATEGORIA = {
  feria: 'Feria',
  fiesta_patronal: 'Fiesta patronal',
  concierto: 'Concierto',
  deportivo: 'Deportivo',
  cultural: 'Cultural',
  otro: 'Otro',
};

const formatearFecha = (iso) =>
  new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function EventoTarjeta({ evento }) {
  return (
    <article className="tarjeta">
      <span className="insignia">{ETIQUETA_CATEGORIA[evento.categoria] || evento.categoria}</span>
      {evento.patrocinado && <span className="insignia">Patrocinado{evento.patrocinador_nombre ? ` por ${evento.patrocinador_nombre}` : ''}</span>}
      <h2>{evento.titulo}</h2>
      <p>{evento.contenido}</p>
      <div className="tarjeta-meta">
        📅 {formatearFecha(evento.fecha_inicio)}
        {evento.fecha_fin && ` — ${formatearFecha(evento.fecha_fin)}`} · 📍 {evento.lugar}
      </div>
      <div className="tarjeta-meta">
        Por {evento.autor?.nombre_usuario || 'alguien'} · {evento.num_comentarios} comentarios
      </div>

      <PanelInteraccion postId={evento._id} reaccionesIniciales={evento.reacciones} />
    </article>
  );
}

export default EventoTarjeta;
