import TarjetaPublicacion, { Dato } from '../../components/TarjetaPublicacion.jsx';

const ETIQUETA_CATEGORIA = { playa: 'Playa', ruta: 'Ruta', gastronomia: 'Gastronomía', otro: 'Otro' };

function TurismoTarjeta({ turismo }) {
  return (
    <TarjetaPublicacion
      post={turismo}
      chips={<span className="insignia">{ETIQUETA_CATEGORIA[turismo.categoria] || turismo.categoria}</span>}
      datos={
        typeof turismo.distancia_metros === 'number' && (
          <Dato icono="ubicacion">A {(turismo.distancia_metros / 1000).toFixed(1)} km de ti</Dato>
        )
      }
    />
  );
}

export default TurismoTarjeta;
