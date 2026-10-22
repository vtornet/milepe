import TarjetaPublicacion, { Dato } from '../../components/TarjetaPublicacion.jsx';
import Icono from '../../components/Icono.jsx';

const ETIQUETA_CATEGORIA = {
  restauracion: 'Restauración',
  alojamiento: 'Alojamiento',
  comercio: 'Comercio',
  servicios: 'Servicios',
  ocio: 'Ocio',
  otros: 'Otros',
};

function NegocioTarjeta({ negocio }) {
  return (
    <TarjetaPublicacion
      post={negocio}
      // Las reseñas de un negocio son comentarios con valoracion: es la
      // unica seccion que enciende el selector de estrellas.
      permitirValoracion
      chips={
        <>
          <span className="insignia">{ETIQUETA_CATEGORIA[negocio.categoria] || negocio.categoria}</span>
          {negocio.destacado && <span className="insignia insignia-destacado"><Icono nombre="estrella" tam={12} /> Destacado</span>}
        </>
      }
      datos={
        <>
          <Dato icono="ubicacion">{negocio.direccion}</Dato>
          <Dato icono="reloj">{negocio.horario}</Dato>
          {typeof negocio.distancia_metros === 'number' && (
            <Dato icono="ubicacion">A {(negocio.distancia_metros / 1000).toFixed(1)} km de ti</Dato>
          )}
        </>
      }
      acciones={
        <>
          {negocio.telefono && (
            <a className="accion" href={`tel:${negocio.telefono.replace(/[^\d+]/g, '')}`}>
              <Icono nombre="telefono" tam={18} />
              {negocio.telefono}
            </a>
          )}
          {negocio.sitio_web && (
            <a className="accion" href={negocio.sitio_web} target="_blank" rel="noreferrer">
              <Icono nombre="enlace" tam={18} />
              Sitio web
            </a>
          )}
        </>
      }
    />
  );
}

export default NegocioTarjeta;
