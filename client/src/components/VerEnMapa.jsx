import { lazy, Suspense, useState } from 'react';
import Icono from './Icono.jsx';

// Leaflet pesa ~155 KB y el Muro no es una página diferida: el mapa se pide
// solo cuando alguien pulsa "Ver en el mapa".
const MapaPunto = lazy(() => import('../pages/Quejas/SelectorUbicacion.jsx').then((m) => ({ default: m.MapaPunto })));

// "Ver en el mapa" de una queja, en su sección y fuera de ella (Muro,
// /p/:id, perfil). punto es { lat, lng }.
function VerEnMapa({ punto }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <div className="queja-mapa-acciones">
        <button type="button" className="btn btn-plano btn-sm" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
          <Icono nombre="ubicacion" tam={16} />
          {abierto ? 'Ocultar el mapa' : 'Ver en el mapa'}
        </button>
        {abierto && (
          <a
            className="btn btn-plano btn-sm"
            href={`https://www.google.com/maps/search/?api=1&query=${punto.lat},${punto.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            Abrir en Google Maps
          </a>
        )}
      </div>
      {/* Solo se monta al pedirlo: un listado de veinte quejas con veinte
          mapas serían cientos de teselas descargadas para nada. */}
      {abierto && (
        <Suspense fallback={<div className="mapa-ubicacion" />}>
          <MapaPunto punto={punto} />
        </Suspense>
      )}
    </>
  );
}

export default VerEnMapa;
