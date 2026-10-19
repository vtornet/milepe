import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import FilaReporte from './FilaReporte.jsx';
import FilaApelacion from './FilaApelacion.jsx';
import RegistroModeracion from './RegistroModeracion.jsx';

const PESTANAS = [
  { clave: 'reportes', etiqueta: 'Reportes' },
  { clave: 'apelaciones', etiqueta: 'Apelaciones' },
  { clave: 'registro', etiqueta: 'Registro' },
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

  useEffect(() => {
    cargarResumen();
  }, [cargarResumen]);

  useEffect(() => {
    let cancelado = false;
    setError(null);

    const cargar = pestana === 'reportes' ? cargarReportes : pestana === 'apelaciones' ? cargarApelaciones : null;
    if (!cargar) return undefined;

    cargar().catch(() => {
      if (!cancelado) setError('No se pudo cargar la lista.');
    });

    return () => {
      cancelado = true;
    };
  }, [pestana, cargarReportes, cargarApelaciones]);

  // Tras resolver algo hay que refrescar la lista completa, no quitar la
  // fila sin más: resolver un reporte puede cambiar el estado del
  // contenido y, con él, lo que muestran las otras filas del mismo post.
  const trasResolver = async () => {
    cargarResumen();
    if (pestana === 'reportes') await cargarReportes();
    if (pestana === 'apelaciones') await cargarApelaciones();
  };

  return (
    <section>
      <h1>Moderación</h1>

      {resumen && (
        <p className="tarjeta-meta">
          {resumen.reportes_pendientes} reporte(s) y {resumen.apelaciones_pendientes} apelación(es) pendientes
          {!esAdmin && ' · las apelaciones las resuelve un administrador'}
        </p>
      )}

      <div className="lista-filtros">
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            onClick={() => setPestana(p.clave)}
            className={pestana === p.clave ? 'activa' : undefined}
          >
            {p.etiqueta}
          </button>
        ))}

        {pestana !== 'registro' && (
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

      {pestana === 'registro' && <RegistroModeracion />}
    </section>
  );
}

export default ModeracionPage;
