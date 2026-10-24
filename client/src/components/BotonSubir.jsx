import { useEffect, useState } from 'react';
import Icono from './Icono.jsx';

// A partir de cuánto hay que haber bajado para que aparezca: algo más de una
// pantalla de móvil. En una página corta no sale nunca, así que vale para
// todas sin tener que decidir página a página.
const UMBRAL_PX = 700;

// Botón flotante para volver arriba en las páginas largas (Teléfonos, el
// Muro, Turismo...), donde subir a mano para elegir otra sección es tedioso.
// Vive en el armazón (App.jsx), una sola vez para toda la app.
function BotonSubir() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Un solo cálculo por fotograma aunque el scroll dispare decenas de
    // eventos por segundo.
    let pendiente = false;
    const comprobar = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => {
        setVisible(window.scrollY > UMBRAL_PX);
        pendiente = false;
      });
    };
    comprobar();
    window.addEventListener('scroll', comprobar, { passive: true });
    return () => window.removeEventListener('scroll', comprobar);
  }, []);

  if (!visible) return null;

  const subir = () => {
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reducir ? 'auto' : 'smooth' });
  };

  return (
    <button type="button" className="boton-subir" onClick={subir} aria-label="Volver arriba" title="Volver arriba">
      <Icono nombre="arriba" tam={22} />
    </button>
  );
}

export default BotonSubir;
