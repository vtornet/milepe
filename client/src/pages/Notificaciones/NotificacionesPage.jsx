import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import Icono from '../../components/Icono.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import { haceCuanto } from '../../utils/fechas.js';

// Avisa al armazón (App.jsx) de que el número de no leídas ha cambiado, para
// que la campana se actualice sin esperar a cambiar de página.
const avisarCambioNotificaciones = () => window.dispatchEvent(new Event('milepe:notificaciones'));

const ICONO_POR_TIPO = {
  comentario: 'comentario',
  reaccion: 'corazon',
  seguidor_nuevo: 'perfil',
  cambio_estado_queja: 'quejas',
  moderacion: 'moderacion',
  mensaje_nuevo: 'mensajes',
  reclamacion_negocio: 'negocios',
};

// A dónde lleva cada aviso. Lo de moderación va a «Mi contenido», que es
// donde se ve el motivo y se puede apelar; el resto, a lo que nombra.
const destino = (n) => {
  if (n.tipo === 'moderacion') return '/mi-contenido';
  if (!n.referencia_id) return null;
  switch (n.referencia_tipo) {
    case 'post':
      return `/p/${n.referencia_id}`;
    case 'usuario':
      return `/vecino/${n.referencia_id}`;
    case 'conversacion':
      return `/mensajes/${n.referencia_id}`;
    default:
      return null;
  }
};

const POR_PAGINA = 20;

function NotificacionesPage() {
  const navigate = useNavigate();
  const [notificaciones, setNotificaciones] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [sinLeer, setSinLeer] = useState(0);
  const [error, setError] = useState(null);

  const cargar = useCallback(async (numero) => {
    const { data } = await api.get('/notificaciones', { params: { pagina: numero, limite: POR_PAGINA } });
    setNotificaciones((actuales) => (numero === 1 ? data.notificaciones : [...(actuales || []), ...data.notificaciones]));
    setHayMas(numero < data.paginacion.totalPaginas);
    setSinLeer(data.sin_leer);
    setPagina(numero);
  }, []);

  useEffect(() => {
    cargar(1).catch(() => setError('No se pudieron cargar las notificaciones.'));
  }, [cargar]);

  const abrir = async (n) => {
    if (!n.leida) {
      setNotificaciones((actuales) => actuales.map((x) => (x._id === n._id ? { ...x, leida: true } : x)));
      setSinLeer((v) => Math.max(0, v - 1));
      api
        .patch(`/notificaciones/${n._id}/leida`)
        .then(avisarCambioNotificaciones)
        .catch(() => {});
    }
    const ruta = destino(n);
    if (ruta) navigate(ruta);
  };

  const marcarTodas = async () => {
    await api.patch('/notificaciones/leidas').catch(() => {});
    setNotificaciones((actuales) => actuales.map((x) => ({ ...x, leida: true })));
    setSinLeer(0);
    avisarCambioNotificaciones();
  };

  return (
    <section>
      <div className="cabecera-pagina">
        <span className="cabecera-pagina-icono" aria-hidden="true">
          <Icono nombre="campana" tam={22} />
        </span>
        <div className="cabecera-pagina-texto">
          <h1>Notificaciones</h1>
          {sinLeer > 0 && <p className="cabecera-pagina-sub">{sinLeer === 1 ? '1 sin leer' : `${sinLeer} sin leer`}</p>}
        </div>
        {sinLeer > 0 && (
          <div className="cabecera-pagina-acciones">
            <button type="button" className="btn btn-contorno btn-sm" onClick={marcarTodas}>
              Marcar todas como leídas
            </button>
          </div>
        )}
      </div>

      {error && <p className="mensaje-error">{error}</p>}
      {!error && notificaciones === null && <EsqueletoFeed cuantas={2} />}
      {notificaciones?.length === 0 && (
        <EstadoVacio icono="campana" titulo="No tienes notificaciones">
          Aquí verás cuando alguien comente o reaccione a lo tuyo, te siga o responda a tus quejas.
        </EstadoVacio>
      )}

      {notificaciones?.length > 0 && (
        <ul className="lista-notificaciones">
          {notificaciones.map((n) => (
            <li key={n._id}>
              <button type="button" className={n.leida ? undefined : 'sin-leer'} onClick={() => abrir(n)}>
                <Icono nombre={ICONO_POR_TIPO[n.tipo] || 'campana'} tam={18} />
                <span className="lista-notificaciones-texto">
                  {n.mensaje}
                  <span className="tarjeta-meta">{haceCuanto(n.fecha_creacion)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hayMas && (
        <button type="button" className="btn btn-plano btn-sm" onClick={() => cargar(pagina + 1).catch(() => {})}>
          Ver más antiguas
        </button>
      )}
    </section>
  );
}

export default NotificacionesPage;
