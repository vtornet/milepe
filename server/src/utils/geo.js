// El cliente (Leaflet) piensa en { lat, lng }; GeoJSON exige
// coordinates: [longitud, latitud], en ese orden, justo al reves de como se
// suele decir en español. Aislamos la conversion aqui para no repetirla (ni
// equivocarnos con el orden) en cada controlador que reciba una ubicacion.
import ErrorHttp from './ErrorHttp.js';

export const aPuntoGeoJSON = (ubicacion) => {
  const lat = ubicacion?.lat;
  const lng = ubicacion?.lng;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new ErrorHttp(400, 'La ubicacion (lat, lng) es obligatoria');
  }

  return { type: 'Point', coordinates: [lng, lat] };
};

// Inverso, para devolver la ubicacion al cliente en el formato que espera
// Leaflet en vez de en crudo GeoJSON.
export const deGeoJSONaLatLng = (punto) => {
  if (!punto?.coordinates) return null;
  const [lng, lat] = punto.coordinates;
  return { lat, lng };
};
