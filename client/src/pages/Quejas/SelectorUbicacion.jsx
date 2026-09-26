import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import marcadorIcono from 'leaflet/dist/images/marker-icon.png';
import marcadorIcono2x from 'leaflet/dist/images/marker-icon-2x.png';
import marcadorSombra from 'leaflet/dist/images/marker-shadow.png';

// El icono por defecto de Leaflet se rompe con bundlers como Vite (las
// rutas relativas que trae por defecto no resuelven); hay que decirle
// explicitamente que imagenes usar.
const iconoMarcador = L.icon({
  iconUrl: marcadorIcono,
  iconRetinaUrl: marcadorIcono2x,
  shadowUrl: marcadorSombra,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Centro por defecto: Lepe (Huelva).
const CENTRO_LEPE = { lat: 37.2545, lng: -7.2039 };

function CapturadorClics({ onSeleccionar }) {
  useMapEvents({
    click(evento) {
      onSeleccionar({ lat: evento.latlng.lat, lng: evento.latlng.lng });
    },
  });
  return null;
}

// Mapa donde el usuario hace clic para marcar donde esta la queja. value es
// { lat, lng } o null; onChange se llama con el punto elegido.
function SelectorUbicacion({ value, onChange }) {
  return (
    <div className="mapa-ubicacion">
      <MapContainer center={value || CENTRO_LEPE} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CapturadorClics onSeleccionar={onChange} />
        {value && <Marker position={value} icon={iconoMarcador} />}
      </MapContainer>
    </div>
  );
}

export default SelectorUbicacion;
