import { useEffect, useState } from 'react';
import api from '../services/api.js';
import Icono from './Icono.jsx';

// La configuración de pagos se pide una vez por carga de la app y se comparte
// entre todas las tarjetas: si no, cada negocio de la lista haría su petición.
let promesaConfig = null;
const cargarConfig = () => {
  if (!promesaConfig) {
    promesaConfig = api
      .get('/pagos/config')
      .then(({ data }) => data)
      .catch(() => {
        promesaConfig = null;
        return { activo: false };
      });
  }
  return promesaConfig;
};

const euros = (centimos) => (centimos / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

// Botón "Destacar · 9,90 €": abre la pasarela de Stripe. Si los pagos no
// están configurados (sin claves en el servidor) no se pinta nada.
function BotonPagar({ producto, postId, texto }) {
  const [config, setConfig] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    cargarConfig().then((c) => !cancelado && setConfig(c));
    return () => {
      cancelado = true;
    };
  }, []);

  const datos = config?.activo && config.productos?.[producto];
  if (!datos) return null;

  const pagar = async () => {
    setError(null);
    setOcupado(true);
    try {
      const { data } = await api.post('/pagos/checkout', { producto, post_id: postId });
      window.location.assign(data.url);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo abrir el pago.');
      setOcupado(false);
    }
  };

  return (
    <div className="boton-pagar">
      <button type="button" className="btn btn-contorno btn-sm" disabled={ocupado} onClick={pagar}>
        <Icono nombre="estrella" tam={14} />
        {ocupado ? 'Abriendo el pago…' : `${texto} · ${euros(datos.importe)}`}
      </button>
      {config.modo_prueba && <span className="tarjeta-meta"> Modo de prueba: no se cobra de verdad.</span>}
      {error && <p className="mensaje-error">{error}</p>}
    </div>
  );
}

export default BotonPagar;
