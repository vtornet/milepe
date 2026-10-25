import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSeguimientos } from '../context/SeguimientosContext.jsx';
import Icono from './Icono.jsx';

// Seguir o dejar de seguir a un vecino. Aparece en su ficha y en cada
// publicación suya del muro.
//
// No pide confirmación para dejar de seguir: es inmediato de rehacer, y un
// "¿seguro?" en un botón reversible solo estorba. Lo que sí avisa es de
// que dejar de seguir cierra la conversación privada, porque eso no es
// evidente y sí tiene consecuencias.
function BotonSeguir({ usuarioId, compacto = false, enLinea = false }) {
  const { usuario } = useAuth();
  const { relacionCon, seguir, dejarDeSeguir } = useSeguimientos();

  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  // Sin sesión no se pinta: el botón llevaría a un 401, y la alternativa
  // -mandar a iniciar sesión- es ruido en cada tarjeta del muro para quien
  // está mirando el pueblo de paso.
  if (!usuario || !usuarioId) return null;
  if (String(usuarioId) === String(usuario._id)) return null;

  const { sigo, mutuo } = relacionCon(usuarioId);

  const alternar = async () => {
    setOcupado(true);
    setError(null);

    try {
      if (sigo) await dejarDeSeguir(usuarioId);
      else await seguir(usuarioId);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo completar la acción.');
    } finally {
      setOcupado(false);
    }
  };

  // En la cabecera de una publicación: texto pulsable en la línea de la
  // fecha. Como botón con borde se comía el sitio del nombre en el móvil
  // ("del…" en vez de "deligober").
  if (enLinea) {
    return (
      <button
        type="button"
        className={`seguir-en-linea${sigo ? '' : ' por-seguir'}`}
        onClick={alternar}
        disabled={ocupado}
        title={sigo ? 'Dejar de seguir' : 'Seguir a este vecino'}
      >
        {sigo ? (mutuo ? 'Os seguís' : 'Siguiendo') : 'Seguir'}
      </button>
    );
  }

  const clase = compacto
    ? `btn btn-sm ${sigo ? 'btn-contorno' : 'btn-primario'}`
    : `btn ${sigo ? 'btn-contorno' : 'btn-primario'}`;

  return (
    <>
      <button
        type="button"
        className={clase}
        onClick={alternar}
        disabled={ocupado}
        title={
          sigo
            ? 'Dejar de seguir. Vuestra conversación privada quedará en solo lectura'
            : 'Seguir a este vecino'
        }
      >
        <Icono nombre={sigo ? 'comprobado' : 'anadir'} tam={compacto ? 14 : 16} />
        {/* Tres estados y no dos: "os seguís" es el que importa, porque es
            el que abre los mensajes privados, y con solo "Siguiendo" no
            habría forma de saber si ya estáis los dos. */}
        {sigo ? (mutuo ? 'Os seguís' : 'Siguiendo') : 'Seguir'}
      </button>

      {error && <span className="mensaje-error">{error}</span>}
    </>
  );
}

export default BotonSeguir;
