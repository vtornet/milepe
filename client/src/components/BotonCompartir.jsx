import { useState } from 'react';
import Icono from './Icono.jsx';

// Compartir una publicación: en el móvil abre el menú del sistema (WhatsApp,
// Telegram...), y donde no lo hay copia el enlace. El enlace es /p/:id, cuya
// vista previa trae título, texto e imagen (netlify/edge-functions/og.js).
function BotonCompartir({ post }) {
  const [copiado, setCopiado] = useState(false);

  const compartir = async () => {
    const url = `${window.location.origin}/p/${post._id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: post.titulo || 'MiLepe', url });
      } catch {
        // Cancelar el menú del sistema no es un error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank', 'noopener');
    }
  };

  return (
    <button type="button" className="boton-reportar-compacto" title={copiado ? 'Enlace copiado' : 'Compartir'} onClick={compartir}>
      <Icono nombre={copiado ? 'comprobado' : 'compartir'} tam={15} />
      {copiado && <span className="solo-lectores">Enlace copiado</span>}
    </button>
  );
}

export default BotonCompartir;
