import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import FilaReporte from './FilaReporte.jsx';
import FilaApelacion from './FilaApelacion.jsx';
import FilaEdicion from './FilaEdicion.jsx';
import RegistroModeracion from './RegistroModeracion.jsx';
import EstadisticasPanel from './EstadisticasPanel.jsx';
import ReclamacionesNegocios from './ReclamacionesNegocios.jsx';

const PESTANAS = [
  { clave: 'reportes', etiqueta: 'Reportes' },
  { clave: 'apelaciones', etiqueta: 'Apelaciones' },
  { clave: 'ediciones', etiqueta: 'Ediciones' },
  { clave: 'registro', etiqueta: 'Registro' },
  // Solo admin: son datos de toda la red, no de la cola de moderación.
  { clave: 'negocios', etiqueta: 'Negocios', soloAdmin: true },
  { clave: 'estadisticas', etiqueta: 'Estadísticas', soloAdmin: true },
];

// Panel del equipo de moderación: la cola de reportes, la de apelaciones y
// el registro de auditoría. Las tres cosas en una página con pestañas y no
// en tres rutas porque se trabajan a la vez: se resuelve un reporte, se
// mira el historial de ese vecino, se vuelve a la cola.
function ModeracionPage() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';

  const [pestana, setPestana] = useState('reportes');
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState(null);

  const [reportes, setReportes] = useState(null);
  const [apelaciones, setApelaciones] = useState(null);
  const [ediciones, setEdiciones] = useState(null);

  const [verResueltos, setVerResueltos] = useState(false);

  const cargarResumen = useCallback(() => {
    api
      .get('/moderacion/resumen')
      .then(({ data }) => setResumen(data))
      .catch(() => setResumen(null));
  }, []);

  const cargarReportes = useCallback(async () => {
    const { data } = await api.get('/moderacion/reportes', {
      params: { estado: verResueltos ? 'todos' : 'pendiente', limite: 50 },
    });
    setReportes(data.reportes);
  }, [verResueltos]);

  const cargarApelaciones = useCallback(async () => {
    const { data } = await api.get('/moderacion/apelaciones', {
      params: { estado: verResueltos ? 'todos' : 'pendiente', limite: 50 },
    });
    setApelaciones(data.apelaciones);
  }, [verResueltos]);

  // Esta cola no tiene "ya resueltas" que mirar: una edicion aprobada
  // desaparece de aqui y lo que queda de ella esta en el registro.
  const cargarEdiciones = useCallback(async () => {
    const { data } = await api.get('/moderacion/ediciones', { params: { limite: 50 } });
    setEdiciones(data.posts);
  }, []);

  useEffect(() => {
    cargarResumen();
  }, [cargarResumen]);

  useEffect(() => {
    let cancelado = false;
    setError(null);

    const porPestana = {
      reportes: cargarReportes,
      apelaciones: cargarApelaciones,
      ediciones: cargarEdiciones,
    };
    const cargar = porPestana[pestana];
    if (!cargar) return undefined;

    cargar().catch(() => {
      if (!cancelado) setError('No se pudo cargar la lista.');
    });

    return () => {
      cancelado = true;
    };
  }, [pestana, cargarReportes, cargarApelaciones, cargarEdiciones]);

  // Tras resolver algo hay que refrescar la lista completa, no quitar la
  // fila sin más: resolver un reporte puede cambiar el estado del
  // contenido y, con él, lo que muestran las otras filas del mismo post.
  const trasResolver = async () => {
    cargarResumen();
    if (pestana === 'reportes') await cargarReportes();
    if (pestana === 'apelaciones') await cargarApelaciones();
    if (pestana === 'ediciones') await cargarEdiciones();
  };

  return (
    <section>
      <h1>Moderación</h1>

      {resumen && (
        <p className="tarjeta-meta">
          {resumen.reportes_pendientes} reporte(s), {resumen.apelaciones_pendientes} apelación(es) y{' '}
          {resumen.ediciones_pendientes ?? 0} edición(es) pendientes
          {!esAdmin && ' · las apelaciones las resuelve un administrador'}
        </p>
      )}

      <div className="lista-filtros">
        {PESTANAS.filter((p) => esAdmin || !p.soloAdmin).map((p) => (
          <button
            key={p.clave}
            type="button"
            onClick={() => setPestana(p.clave)}
            className={pestana === p.clave ? 'activa' : undefined}
          >
            {p.etiqueta}
          </button>
        ))}

        {!['registro', 'ediciones', 'estadisticas', 'negocios'].includes(pestana) && (
          <label className="filtro-casilla">
            <input
              type="checkbox"
              checked={verResueltos}
              onChange={(evento) => setVerResueltos(evento.target.checked)}
            />
            Ver también los ya resueltos
          </label>
        )}
      </div>

      {error && <p className="mensaje-error">{error}</p>}

      {pestana === 'reportes' && (
        <>
          {reportes === null && <p>Cargando reportes...</p>}
          {reportes?.length === 0 && <p>No hay reportes {verResueltos ? '' : 'pendientes'}. Buena señal.</p>}
          {reportes?.map((reporte) => (
            <FilaReporte key={reporte._id} reporte={reporte} onResuelto={trasResolver} />
          ))}
        </>
      )}

      {pestana === 'apelaciones' && (
        <>
          {apelaciones === null && <p>Cargando apelaciones...</p>}
          {apelaciones?.length === 0 && <p>No hay apelaciones {verResueltos ? '' : 'pendientes'}.</p>}
          {apelaciones?.map((apelacion) => (
            <FilaApelacion
              key={apelacion._id}
              apelacion={apelacion}
              puedeResolver={esAdmin}
              onResuelta={trasResolver}
            />
          ))}
        </>
      )}

      {pestana === 'ediciones' && (
        <>
          {ediciones === null && <p>Cargando ediciones...</p>}
          {ediciones?.length === 0 && (
            <p>
              No hay ediciones por revisar. Aquí solo entran las publicaciones a las que su autor le cambió las
              fotos, y siguen viéndose mientras esperan.
            </p>
          )}
          {ediciones?.map((post) => (
            <FilaEdicion key={post._id} post={post} onResuelta={trasResolver} />
          ))}
        </>
      )}

      {pestana === 'registro' && <RegistroModeracion />}

      {pestana === 'negocios' && esAdmin && <ReclamacionesNegocios />}

      {pestana === 'estadisticas' && esAdmin && <EstadisticasPanel />}
    </section>
  );
}

export default ModeracionPage;
