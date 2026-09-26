import PanelInteraccion from '../../components/PanelInteraccion.jsx';

function FotoTarjeta({ foto }) {
  return (
    <article className="tarjeta">
      <span className="insignia">{foto.epoca === 'antigua' ? `Antigua · años ${foto.decada}` : 'Actual'}</span>
      <h2>{foto.titulo}</h2>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
        {foto.imagenes.map((url) => (
          <img key={url} src={url} alt={foto.titulo} style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8 }} />
        ))}
      </div>

      <p>{foto.contenido}</p>
      <div className="tarjeta-meta">
        Por {foto.autor?.nombre_usuario || 'alguien'} · {new Date(foto.fecha_creacion).toLocaleString('es-ES')} ·{' '}
        {foto.num_comentarios} comentarios
      </div>

      <PanelInteraccion postId={foto._id} reaccionesIniciales={foto.reacciones} />
    </article>
  );
}

export default FotoTarjeta;
