import PanelInteraccion from '../../components/PanelInteraccion.jsx';

const ETIQUETA_CATEGORIA = { playa: 'Playa', ruta: 'Ruta', gastronomia: 'Gastronomía', otro: 'Otro' };

function TurismoTarjeta({ turismo }) {
  return (
    <article className="tarjeta">
      <span className="insignia">{ETIQUETA_CATEGORIA[turismo.categoria] || turismo.categoria}</span>
      <h2>{turismo.titulo}</h2>
      {turismo.imagenes?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
          {turismo.imagenes.map((url) => (
            <img key={url} src={url} alt={turismo.titulo} style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8 }} />
          ))}
        </div>
      )}
      <p>{turismo.contenido}</p>
      {typeof turismo.distancia_metros === 'number' && (
        <div className="tarjeta-meta">📏 A {(turismo.distancia_metros / 1000).toFixed(1)} km</div>
      )}
      <div className="tarjeta-meta">
        Por {turismo.autor?.nombre_usuario || 'alguien'} · {new Date(turismo.fecha_creacion).toLocaleString('es-ES')} ·{' '}
        {turismo.num_comentarios} comentarios
      </div>

      <PanelInteraccion postId={turismo._id} reaccionesIniciales={turismo.reacciones} />
    </article>
  );
}

export default TurismoTarjeta;
