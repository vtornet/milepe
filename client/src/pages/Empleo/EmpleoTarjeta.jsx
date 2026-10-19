import { useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import TarjetaPublicacion, { Dato } from '../../components/TarjetaPublicacion.jsx';
import { fechaCorta } from '../../utils/fechas.js';

const ETIQUETA_SECTOR = {
  agricola: 'Agrícola',
  hosteleria: 'Hostelería',
  construccion: 'Construcción',
  comercio: 'Comercio',
  otros: 'Otros',
};

function EmpleoTarjeta({ empleo, onRepublicado }) {
  const { usuario } = useAuth();
  const [republicando, setRepublicando] = useState(false);
  const [error, setError] = useState(null);

  const esAutor = usuario && empleo.autor?._id === usuario._id;
  const caducada = empleo.modalidad === 'ofrezco' && empleo.estado_oferta === 'caducada';

  const republicar = async () => {
    setRepublicando(true);
    setError(null);
    try {
      await api.patch(`/empleo/${empleo._id}/republicar`);
      onRepublicado(empleo._id);
    } catch (err) {
      // Antes esto era un alert() del navegador: bloqueaba la pagina y se
      // leia como un error del sistema, no de la oferta.
      setError(err.response?.data?.mensaje || 'No se pudo republicar la oferta.');
    } finally {
      setRepublicando(false);
    }
  };

  return (
    <TarjetaPublicacion
      post={empleo}
      chips={
        <>
          <span className={`insignia ${empleo.modalidad === 'ofrezco' ? 'insignia-marca' : ''}`}>
            {empleo.modalidad === 'ofrezco' ? 'Se ofrece' : 'Busca trabajo'}
          </span>
          <span className="insignia">{ETIQUETA_SECTOR[empleo.sector] || empleo.sector}</span>
          {caducada && <span className="insignia insignia-peligro">Caducada</span>}
        </>
      }
      datos={
        empleo.modalidad === 'busco' ? (
          <>
            <Dato icono="ubicacion">{empleo.zona}</Dato>
            <Dato icono="reloj">Disponible desde el {fechaCorta(empleo.disponible_desde)}</Dato>
          </>
        ) : (
          <>
            <Dato icono="empleo">{empleo.puesto}</Dato>
            <Dato icono="euro">{empleo.jornal} €/día</Dato>
            <Dato icono="reloj">
              {caducada ? 'Caducó' : 'Caduca'} el {fechaCorta(empleo.fecha_caducidad)}
            </Dato>
          </>
        )
      }
    >
      {caducada && esAutor && (
        <div style={{ marginTop: 'var(--e-3)' }}>
          <button type="button" className="btn btn-contorno btn-sm" onClick={republicar} disabled={republicando}>
            {republicando ? 'Republicando...' : 'Republicar 30 días más'}
          </button>
          {error && <p className="mensaje-error">{error}</p>}
        </div>
      )}
    </TarjetaPublicacion>
  );
}

export default EmpleoTarjeta;
