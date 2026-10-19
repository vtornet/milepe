import { Link } from 'react-router-dom';

const ETIQUETA_ESTADO = {
  publicado: 'visible',
  oculto: 'oculto',
  eliminado: 'eliminado',
};

// Pinta el contenido reportado o apelado, que puede ser un post o un
// comentario. Las dos colas y la vista del autor lo necesitan igual, así
// que vive aparte en vez de repetir el mismo if tres veces.
function VistaContenido({ contenidoTipo, contenido }) {
  if (!contenido) {
    // El backend devuelve null si el documento ya no está. No debería pasar
    // (nada se borra de verdad), pero decirlo es mejor que dejar un hueco.
    return <p className="tarjeta-meta">El contenido ya no está disponible.</p>;
  }

  const autor = contenido.autor_id?.nombre_usuario;

  return (
    <div className="contenido-moderado">
      <div className="tarjeta-meta">
        {contenidoTipo === 'post' ? `Publicación (${contenido.tipo})` : 'Comentario'}
        {autor && ` de ${autor}`} · {new Date(contenido.fecha_creacion).toLocaleString('es-ES')} ·{' '}
        <span className="insignia">{ETIQUETA_ESTADO[contenido.estado_moderacion]}</span>
      </div>

      {contenidoTipo === 'post' ? (
        <>
          {contenido.titulo && <strong>{contenido.titulo}</strong>}
          <p className="contenido-moderado-texto">{contenido.contenido}</p>
          {contenido.imagenes?.length > 0 && (
            <p className="tarjeta-meta">{contenido.imagenes.length} imagen(es) adjunta(s)</p>
          )}
        </>
      ) : (
        <>
          <p className="contenido-moderado-texto">{contenido.texto}</p>
          {contenido.post_id && (
            <p className="tarjeta-meta">
              <Link to={`/?post=${contenido.post_id}`}>Ver la publicación donde se escribió</Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default VistaContenido;
