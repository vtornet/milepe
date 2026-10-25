import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import Icono from '../../components/Icono.jsx';
import { EsqueletoLista } from '../../components/Esqueleto.jsx';

const euros = (centimos) => (centimos / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const fechaHora = (iso) => new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
const nombreMes = (mes) =>
  new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const PRODUCTO = { negocio_destacado: 'Negocio destacado', evento_patrocinado: 'Evento patrocinado', verificacion: 'Perfil verificado (mes)' };
const ESTADO = {
  pagado: { texto: 'Pagado', clase: 'insignia-exito' },
  pendiente: { texto: 'Pendiente', clase: 'insignia-aviso' },
  caducado: { texto: 'Abandonado', clase: '' },
  fallido: { texto: 'Fallido', clase: 'insignia-peligro' },
};

// Los cobros de Stripe, para el admin: cuánto entra y quién paga qué, sin
// tener que abrir el panel de Stripe. Los de prueba y los reales van aparte.
function PagosPanel() {
  const [modo, setModo] = useState('real');
  const [estado, setEstado] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setDatos(null);
    setError(null);
    api
      .get('/pagos/admin', { params: { modo, estado: estado || undefined } })
      .then(({ data }) => !cancelado && setDatos(data))
      .catch((err) => !cancelado && setError(err.response?.data?.mensaje || 'No se pudieron cargar los pagos.'));
    return () => {
      cancelado = true;
    };
  }, [modo, estado]);

  return (
    <section>
      <div className="lista-filtros">
        <select value={modo} onChange={(e) => setModo(e.target.value)} aria-label="Modo">
          <option value="real">Cobros reales</option>
          <option value="prueba">Pagos de prueba</option>
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          <option value="pagado">Pagados</option>
          <option value="pendiente">Pendientes</option>
          <option value="caducado">Abandonados</option>
          <option value="fallido">Fallidos</option>
        </select>
      </div>

      {error && (
        <div className="aviso aviso-error">
          <Icono nombre="alerta" tam={18} />
          <span>{error}</span>
        </div>
      )}
      {!datos && !error && <EsqueletoLista cuantas={4} />}

      {datos && (
        <>
          <div className="pagos-resumen">
            <div className="tarjeta">
              <span className="tarjeta-meta">Cobrado en {nombreMes(datos.mes)}</span>
              <strong>{euros(datos.resumen.cobrado_mes)}</strong>
              <span className="tarjeta-meta">
                {datos.resumen.pagos_mes} {datos.resumen.pagos_mes === 1 ? 'pago' : 'pagos'}
              </span>
            </div>
            <div className="tarjeta">
              <span className="tarjeta-meta">Cobrado en total</span>
              <strong>{euros(datos.resumen.cobrado_total)}</strong>
              <span className="tarjeta-meta">
                {datos.resumen.pagos_total} {datos.resumen.pagos_total === 1 ? 'pago' : 'pagos'}
              </span>
            </div>
          </div>
          {modo === 'prueba' && <p className="tarjeta-meta">Pagos con tarjetas de prueba de Stripe: no es dinero real.</p>}
          {(datos.resumen.por_estado.pendiente || 0) > 0 && (
            <p className="tarjeta-meta">
              Un pago «pendiente» es alguien que abrió la pasarela y no terminó (o cuyo aviso de Stripe aún no ha llegado). Stripe
              lo da por abandonado al cabo de 24 horas.
            </p>
          )}

          {datos.pagos.length === 0 && <p className="tarjeta-meta">No hay pagos con este filtro.</p>}
          {datos.pagos.map((p) => (
            <article key={p._id} className="tarjeta fila pago-fila">
              <div>
                <strong>{PRODUCTO[p.producto] || p.producto}</strong>
                {p.post_id ? (
                  <>
                    {' · '}
                    <Link to={`/p/${p.post_id._id}`}>{p.post_id.titulo}</Link>
                  </>
                ) : null}
                <div className="tarjeta-meta">
                  {p.usuario_id?.nombre_usuario || 'cuenta eliminada'} · {fechaHora(p.fecha_creacion)} · {p.dias}{' '}
                  {p.dias === 1 ? 'día' : 'días'}
                  {p.vigente_hasta && ` · hasta el ${new Date(p.vigente_hasta).toLocaleDateString('es-ES')}`}
                </div>
              </div>
              <div className="pago-importe">
                <strong>{euros(p.importe)}</strong>
                <span className={`insignia ${ESTADO[p.estado]?.clase || ''}`}>{ESTADO[p.estado]?.texto || p.estado}</span>
              </div>
            </article>
          ))}
        </>
      )}
    </section>
  );
}

export default PagosPanel;
