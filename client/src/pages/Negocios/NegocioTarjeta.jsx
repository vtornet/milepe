import PanelInteraccion from '../../components/PanelInteraccion.jsx';

const ETIQUETA_CATEGORIA = {
  restauracion: 'Restauración',
  alojamiento: 'Alojamiento',
  comercio: 'Comercio',
  servicios: 'Servicios',
  ocio: 'Ocio',
  otros: 'Otros',
};

function NegocioTarjeta({ negocio }) {
  return (
    <article className="tarjeta">
      <span className="insignia">{ETIQUETA_CATEGORIA[negocio.categoria] || negocio.categoria}</span>
      {negocio.destacado && <span className="insignia">⭐ Destacado</span>}
      <h2>{negocio.titulo}</h2>
      <p>{negocio.contenido}</p>
      <div className="tarjeta-meta">📍 {negocio.direccion}</div>
      {negocio.horario && <div className="tarjeta-meta">🕒 {negocio.horario}</div>}
      <div className="tarjeta-meta">
        {negocio.telefono && (
          <>
            📞 <a href={`tel:${negocio.telefono}`}>{negocio.telefono}</a>{' '}
          </>
        )}
        {negocio.sitio_web && (
          <a href={negocio.sitio_web} target="_blank" rel="noreferrer">
            🌐 Sitio web
          </a>
        )}
      </div>
      {typeof negocio.distancia_metros === 'number' && (
        <div className="tarjeta-meta">📏 A {(negocio.distancia_metros / 1000).toFixed(1)} km</div>
      )}

      <PanelInteraccion postId={negocio._id} reaccionesIniciales={negocio.reacciones} permitirValoracion />
    </article>
  );
}

export default NegocioTarjeta;
