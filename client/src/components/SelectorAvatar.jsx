import { useRef, useState } from 'react';
import api from '../services/api.js';
import Avatar from './Avatar.jsx';
import Icono from './Icono.jsx';
import { reducirImagen } from '../utils/reducirImagen.js';

// Selector de foto de perfil: elige archivo, lo reduce en el propio móvil y lo
// sube a /api/subidas/avatar (que, a diferencia de /imagenes, no exige el
// perfil completo: la foto es parte de lo que lo completa). Devuelve la URL al
// padre, que la guarda al pulsar Guardar.
//
// La vista previa se pinta antes de que termine la subida, con un
// createObjectURL local: en un móvil con poca cobertura, ver la foto al
// instante es la diferencia entre "ya está" y "no sé si ha funcionado".
function SelectorAvatar({ url, nombreUsuario, onCambio }) {
  const entrada = useRef(null);
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);

  const elegir = async (evento) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;

    setError(null);

    if (!archivo.type.startsWith('image/')) {
      setError('Ese archivo no es una imagen.');
      return;
    }
    // Una foto de perfil no necesita más de 1024 px: reducirla aquí evita el
    // límite de 8 MB (las fotos de móvil lo pasan a menudo) y gasta menos datos.
    const reducida = await reducirImagen(archivo, { ladoMaximo: 1024 });
    if (reducida.size > 8 * 1024 * 1024) {
      setError('La imagen no puede pasar de 8 MB.');
      return;
    }

    setVistaPrevia(URL.createObjectURL(reducida));
    setSubiendo(true);

    try {
      const formulario = new FormData();
      formulario.append('imagen', reducida);
      const { data } = await api.post('/subidas/avatar', formulario);
      onCambio(data.imagenes[0]);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo subir la foto.');
      setVistaPrevia(null);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="selector-avatar">
      {vistaPrevia || url ? (
        <img className="selector-avatar-foto" src={vistaPrevia || url} alt="" />
      ) : (
        <Avatar usuario={{ nombre_usuario: nombreUsuario }} tamano="lg" />
      )}

      <div>
        <button type="button" className="btn btn-contorno btn-sm" onClick={() => entrada.current?.click()} disabled={subiendo}>
          <Icono nombre="fotos" tam={16} />
          {subiendo ? 'Subiendo...' : url ? 'Cambiar foto' : 'Elegir foto'}
        </button>
        <p className="campo-pista" style={{ marginTop: 'var(--e-1)' }}>JPG o PNG, hasta 8 MB.</p>
        {error && <p className="mensaje-error">{error}</p>}
      </div>

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        onChange={elegir}
        className="solo-lectores"
        aria-label="Elegir foto de perfil"
      />
    </div>
  );
}

export default SelectorAvatar;
