import { contarReacciones, reaccionesPresentes } from '../utils/reacciones.js';

// Los emojis que ya tiene algo, con el total al lado. Si nadie ha
// reaccionado no se pinta nada: un "0" solo subraya el vacío.
//
// Vive aparte porque lo usan la barra de una publicación y cada comentario
// del hilo, que son dos sitios con tamaños distintos y el mismo contenido.
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

export default ResumenReacciones;
