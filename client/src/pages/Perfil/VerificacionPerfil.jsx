import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import InsigniaVerificado from '../../components/InsigniaVerificado.jsx';

const euros = (centimos) => (centimos / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const fecha = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

// La sección "Perfil verificado" de /perfil: suscribirse (1 €/mes), darse de
// baja o reactivar. La baja solo apaga la renovación: la insignia sigue hasta
// el final del mes ya pagado.
function VerificacionPerfil() {
  const [estado, setEstado] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmarBaja, setConfirmarBaja] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/pagos/verificacion')
      .then(({ data }) => setEstado(data))
      .catch(() => setEstado(null));
  }, []);

  if (!estado) return null;
  // Sin pagos configurados y sin verificación, no hay nada que ofrecer.
  if (!estado.pagos_activos && !estado.verificado) return null;

  const accion = async (ruta, irAStripe = false) => {
    setError(null);
    setOcupado(true);
    try {
      const { data } = await api.post(ruta);
      if (irAStripe) {
        window.location.assign(data.url);
        return;
      }
      setEstado(data);
      setConfirmarBaja(false);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo completar.');
    } finally {
      if (!irAStripe) setOcupado(false);
    }
  };

  const s = estado.suscripcion;
  const enCurso = s.estado === 'activa' || s.estado === 'impagada';

  return (
    <section className="tarjeta verificacion-perfil">
      <h2>
        Perfil verificado <InsigniaVerificado usuario={{ verificado_manual: estado.verificado }} />
      </h2>

      {estado.manual ? (
        <p>Tu perfil está verificado por el equipo de MiLepe. No tienes que pagar nada.</p>
      ) : (
        <>
          {!estado.verificado && !enCurso && (
            <>
              <p>
                Lleva la insignia azul junto a tu nombre en todo lo que publicas por {euros(estado.precio)} al mes. Te das de baja
                cuando quieras y la conservas hasta el final del mes pagado.
              </p>
              <button type="button" className="btn btn-primario" disabled={ocupado} onClick={() => accion('/pagos/verificacion', true)}>
                {ocupado ? 'Abriendo el pago…' : `Verificar mi perfil · ${euros(estado.precio)}/mes`}
              </button>
            </>
          )}

          {estado.verificado && !enCurso && (
            <p>
              Tu perfil está verificado hasta el <strong>{fecha(estado.hasta)}</strong>. No se renovará.
            </p>
          )}

          {enCurso && !s.renovacion_cancelada && (
            <>
              <p>
                Tu perfil está verificado. La suscripción ({euros(estado.precio)}/mes) se renueva el{' '}
                <strong>{fecha(s.fin_periodo || estado.hasta)}</strong>.
              </p>
              {s.estado === 'impagada' && (
                <p className="mensaje-error">
                  No se pudo cobrar la última renovación. Stripe volverá a intentarlo; revisa tu tarjeta en el correo que te ha enviado.
                </p>
              )}
              {confirmarBaja ? (
                <div className="fila" style={{ gap: 'var(--e-2)', flexWrap: 'wrap' }}>
                  <span>¿Darte de baja? Seguirás verificado hasta el {fecha(s.fin_periodo || estado.hasta)}.</span>
                  <button type="button" className="btn btn-peligro btn-sm" disabled={ocupado} onClick={() => accion('/pagos/verificacion/baja')}>
                    Sí, darme de baja
                  </button>
                  <button type="button" className="btn btn-contorno btn-sm" onClick={() => setConfirmarBaja(false)}>
                    No
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn-plano btn-sm" onClick={() => setConfirmarBaja(true)}>
                  Darme de baja
                </button>
              )}
            </>
          )}

          {enCurso && s.renovacion_cancelada && (
            <>
              <p>
                Te has dado de baja: sigues verificado hasta el <strong>{fecha(s.fin_periodo || estado.hasta)}</strong> y después no
                se te cobrará más.
              </p>
              <button type="button" className="btn btn-contorno btn-sm" disabled={ocupado} onClick={() => accion('/pagos/verificacion/reactivar')}>
                Seguir suscrito
              </button>
            </>
          )}
        </>
      )}
      {error && <p className="mensaje-error">{error}</p>}
    </section>
  );
}

export default VerificacionPerfil;
