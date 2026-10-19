import TarjetaPublicacion from '../../components/TarjetaPublicacion.jsx';

function FotoTarjeta({ foto }) {
  return (
    <TarjetaPublicacion
      post={foto}
      chips={
        foto.epoca === 'antigua' ? (
          // La decada es el gancho de una foto antigua, asi que se destaca
          // en vez de quedar como un dato al pie.
          <span className="insignia insignia-marca">Años {foto.decada}</span>
        ) : (
          <span className="insignia">Actual</span>
        )
      }
    />
  );
}

export default FotoTarjeta;
