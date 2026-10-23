import { useEffect, useRef, useState } from 'react';
import Icono from './Icono.jsx';
import { MAX_FOTOS, TAMANO_MAXIMO_FOTO, TIPOS_FOTO } from '../utils/subidas.js';

// Miniatura de un archivo todavía sin subir. Cada una crea y libera su
// propia URL local: si lo hiciera el selector con toda la lista, cada
// archivo añadido o quitado regeneraría las de todos los demás.
function Miniatura({ archivo, onQuitar }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    const local = URL.createObjectURL(archivo);
    setUrl(local);
    return () => URL.revokeObjectURL(local);
  }, [archivo]);

  return (
    <div className="edicion-imagen">
      {url && <img src={url} alt="" />}
      <button type="button" className="edicion-quitar" title="Quitar esta foto" onClick={onQuitar}>
        <Icono nombre="cerrar" tam={14} />
      </button>
    </div>
  );
}

// Elegir fotos para una publicación: se van añadiendo (no sustituyen a las
// anteriores), se ven en miniatura y se pueden quitar una a una antes de
// publicar. El padre es dueño de la lista de `File` y es quien las sube
// (utils/subidas.js) al enviar el formulario; aquí no se sube nada.
function SelectorFotos({ archivos, onChange, max = MAX_FOTOS, etiqueta = 'Fotos (opcional)' }) {
  const entrada = useRef(null);
  const [aviso, setAviso] = useState(null);

  const anadir = (evento) => {
    const elegidos = Array.from(evento.target.files || []);
    // Se vacía el input para que volver a elegir el mismo archivo (tras
    // quitarlo) dispare otro evento change.
    evento.target.value = '';
    if (elegidos.length === 0) return;

    const avisos = [];
    const validos = elegidos.filter((archivo) => {
      if (!TIPOS_FOTO.includes(archivo.type)) {
        avisos.push(`"${archivo.name}" no es una imagen admitida (JPG, PNG, WebP o GIF).`);
        return false;
      }
      if (archivo.size > TAMANO_MAXIMO_FOTO) {
        avisos.push(`"${archivo.name}" pasa de 8 MB.`);
        return false;
      }
      return true;
    });

    const hueco = max - archivos.length;
    if (validos.length > hueco) {
      avisos.push(`Solo se pueden añadir ${max} fotos.`);
    }

    setAviso(avisos.length > 0 ? avisos.join(' ') : null);
    if (hueco > 0 && validos.length > 0) onChange([...archivos, ...validos.slice(0, hueco)]);
  };

  return (
    <div className="selector-fotos">
      <label>{etiqueta}</label>

      {archivos.length > 0 && (
        <div className="edicion-imagenes">
          {archivos.map((archivo, i) => (
            <Miniatura
              key={`${archivo.name}-${archivo.size}-${archivo.lastModified}`}
              archivo={archivo}
              onQuitar={() => onChange(archivos.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      )}

      <input ref={entrada} type="file" accept={TIPOS_FOTO.join(',')} multiple hidden onChange={anadir} />
      <button
        type="button"
        className="btn btn-contorno btn-sm"
        onClick={() => entrada.current?.click()}
        disabled={archivos.length >= max}
      >
        <Icono nombre="anadir" tam={14} /> {archivos.length === 0 ? 'Añadir fotos' : 'Añadir más'}
        {archivos.length > 0 && ` (${archivos.length}/${max})`}
      </button>

      {aviso && <p className="mensaje-error">{aviso}</p>}
    </div>
  );
}

export default SelectorFotos;
