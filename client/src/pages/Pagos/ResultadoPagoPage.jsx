import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../services/api.js';
import Icono from '../../components/Icono.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import { useTitulo } from '../../hooks/useTitulo.js';

const ESPERA_MS = 2000;
const MAX_INTENTOS = 15;

const fecha = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

// A donde vuelve Stripe después de pagar (o de cancelar). Lo que manda es el
// webhook, no esta vuelta: aquí solo se espera a que el servidor diga que el
// pago está aplicado (suele tardar un par de segundos).
function ResultadoPagoPage() {
  useTitulo('Pago');
  const [parametros] = useSearchParams();
  const pagoId = parametros.get('pago');
  const cancelado = parametros.get('cancelado') === '1';
  const [pago, setPago] = useState(null);
  const [agotado, setAgotado] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pagoId || cancelado) return undefined;
    let cancelar = false;
    let temporizador;
    const preguntar = async (intento) => {
      try {
        const { data } = await api.get(`/pagos/${pagoId}`);
        if (cancelar) return;
        setPago(data.pago);
        if (data.pago.estado === 'pendiente') {
          if (intento < MAX_INTENTOS) temporizador = setTimeout(() => preguntar(intento + 1), ESPERA_MS);
          else setAgotado(true);
        }
      } catch (err) {
        if (!cancelar) setError(err.response?.data?.mensaje || 'No se pudo comprobar el pago.');
      }
    };
    preguntar(1);
    return () => {
      cancelar = true;
      clearTimeout(temporizador);
    };
  }, [pagoId, cancelado]);

  const volver = pago?.post_id?._id ? `/p/${pago.post_id._id}` : '/';

  if (cancelado) {
    return (
      <EstadoVacio icono="cerrar" titulo="Pago cancelado" accion={<Link to="/" className="btn btn-primario">Volver</Link>}>
        No se ha cobrado nada. Puedes intentarlo de nuevo cuando quieras.
      </EstadoVacio>
    );
  }
  if (error) {
    return (
      <div className="aviso aviso-error">
        <Icono nombre="alerta" tam={18} />
        <span>{error}</span>
      </div>
    );
  }
  if (pago?.estado === 'pagado') {
    return (
      <EstadoVacio
        icono="estrella"
        titulo="¡Pago recibido!"
        accion={
          <Link to={volver} className="btn btn-primario">
            Ver {pago.post_id?.tipo === 'evento' ? 'el evento' : 'el negocio'}
          </Link>
        }
      >
        «{pago.post_id?.titulo}» queda {pago.producto === 'evento_patrocinado' ? 'patrocinado' : 'destacado'} hasta el{' '}
        {fecha(pago.vigente_hasta)}. Te llegará el recibo de Stripe por correo.
      </EstadoVacio>
    );
  }
  if (pago && ['caducado', 'fallido'].includes(pago.estado)) {
    return (
      <EstadoVacio icono="alerta" titulo="El pago no se completó" accion={<Link to={volver} className="btn btn-primario">Volver</Link>}>
        No se ha cobrado nada. Puedes intentarlo de nuevo.
      </EstadoVacio>
    );
  }
  return (
    <EstadoVacio icono="reloj" titulo={agotado ? 'Pago en proceso' : 'Comprobando el pago…'}>
      {agotado
        ? 'Stripe todavía no nos ha confirmado el pago. Si se ha cobrado, se aplicará solo en unos minutos; no hace falta pagar otra vez.'
        : 'Un momento: estamos esperando la confirmación de Stripe.'}
    </EstadoVacio>
  );
}

export default ResultadoPagoPage;
