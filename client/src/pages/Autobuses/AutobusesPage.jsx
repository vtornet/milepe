import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api.js';
import CabeceraSeccion from '../../components/CabeceraSeccion.jsx';
import Icono from '../../components/Icono.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import useSondeo from '../../hooks/useSondeo.js';

const NOMBRE_TIPO_DIA = { laborables: 'Lunes a viernes', sabados: 'Sábados', domingos: 'Domingos' };
const TIPOS_DIA = ['laborables', 'sabados', 'domingos'];
const HOY_ES = { laborables: 'día laborable', sabados: 'sábado', domingos: 'domingo' };

const aMinutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
const sumarMinutos = (hora, minutos) => {
  const total = (aMinutos(hora) + minutos) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const faltan = (min) => {
  if (min <= 0) return 'ahora';
  if (min < 60) return `en ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `en ${h} h${m ? ` ${m} min` : ''}`;
};

const diaLegible = (dia) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

// "Próximo: 13:50 (en 25 min) · 15:45 · 16:50" o, si hoy no quedan, cuándo
// es la siguiente. `desfase` son los minutos desde la primera parada (urbano).
function Proximas({ proximas, desfase = 0 }) {
  if (proximas.hoy.length > 0) {
    const [primera, ...resto] = proximas.hoy;
    return (
      <p className="bus-proximas">
        <strong>{sumarMinutos(primera.hora, desfase)}</strong>{' '}
        <span className="tarjeta-meta">({faltan(primera.faltan_min + desfase)})</span>
        {resto.map((p) => (
          <span key={p.hora} className="tarjeta-meta">
            {' · '}
            {sumarMinutos(p.hora, desfase)}
          </span>
        ))}
      </p>
    );
  }
  if (proximas.siguiente) {
    return (
      <p className="bus-proximas tarjeta-meta">
        Hoy ya no quedan. El siguiente: {proximas.siguiente.es_manana ? 'mañana' : diaLegible(proximas.siguiente.dia)} a las{' '}
        <strong>{sumarMinutos(proximas.siguiente.hora, desfase)}</strong>
      </p>
    );
  }
  return <p className="bus-proximas tarjeta-meta">Sin servicio.</p>;
}

// Las salidas completas de un sentido, por tipo de día.
function TablaHorarios({ horarios, desfase = 0, tipoHoy }) {
  return (
    <div className="bus-tabla">
      {TIPOS_DIA.map((tipo) => (
        <div key={tipo} className={tipo === tipoHoy ? 'bus-dia hoy' : 'bus-dia'}>
          <strong>
            {NOMBRE_TIPO_DIA[tipo]}
            {tipo === tipoHoy && ' (hoy)'}
          </strong>
          <p>{horarios[tipo]?.length ? horarios[tipo].map((h) => sumarMinutos(h, desfase)).join(' · ') : 'Sin servicio'}</p>
        </div>
      ))}
    </div>
  );
}

function LineaUrbana({ linea, tipoHoy }) {
  const sentido = linea.sentidos[0];
  const [parada, setParada] = useState(linea.paradas[0]?.nombre || '');
  const [verTodo, setVerTodo] = useState(false);
  const desfase = linea.paradas.find((p) => p.nombre === parada)?.minutos || 0;
  if (!sentido) return null;

  // Las próximas del servidor son las de la primera parada: en una parada
  // posterior, un autobús que salió hace poco del Centro de Salud aún no ha
  // pasado. Se recalcula con el desfase sobre las salidas completas de hoy.
  const ahoraMin = aMinutos(linea.ahora.hora);
  const deHoy = (sentido.horarios[tipoHoy] || [])
    .filter((h) => aMinutos(h) + desfase >= ahoraMin)
    .slice(0, 3)
    .map((hora) => ({ hora, faltan_min: aMinutos(hora) - ahoraMin }));
  const proximas = deHoy.length ? { hoy: deHoy, siguiente: null } : { hoy: [], siguiente: sentido.proximas.siguiente };

  return (
    <article className="tarjeta">
      <div className="hilo-cabecera">
        <h2 className="bus-titulo">
          <Icono nombre="autobus" tam={18} /> {linea.nombre}
        </h2>
        <span className="tarjeta-meta">{linea.operador}</span>
      </div>

      <label htmlFor="parada-urbano">Tu parada</label>
      <select id="parada-urbano" value={parada} onChange={(e) => setParada(e.target.value)}>
        {linea.paradas.map((p) => (
          <option key={p.nombre} value={p.nombre}>
            {p.nombre}
          </option>
        ))}
      </select>
      <Proximas proximas={proximas} desfase={desfase} />

      <button type="button" className="btn btn-plano btn-sm" onClick={() => setVerTodo(!verTodo)} aria-expanded={verTodo}>
        {verTodo ? 'Ocultar el horario completo' : 'Ver el horario completo'}
      </button>
      {verTodo && (
        <>
          <TablaHorarios horarios={sentido.horarios} desfase={desfase} tipoHoy={tipoHoy} />
          <p className="tarjeta-meta">
            Recorrido: {linea.paradas.map((p) => `${p.nombre} (+${p.minutos}′)`).join(' → ')}
          </p>
        </>
      )}
      <PieLinea linea={linea} />
    </article>
  );
}

function LineaInterurbana({ linea, tipoHoy }) {
  const [verTodo, setVerTodo] = useState(false);
  return (
    <article className="tarjeta">
      <div className="hilo-cabecera">
        <h2 className="bus-titulo">
          <Icono nombre="autobus" tam={18} /> {linea.nombre}
        </h2>
        <span className="tarjeta-meta">{linea.operador}</span>
      </div>

      {linea.sentidos.map((s) => (
        <div key={s.desde} className="bus-sentido">
          <span className="bus-sentido-nombre">
            Desde {s.desde} <span aria-hidden="true">→</span> {s.hacia}
          </span>
          <Proximas proximas={s.proximas} />
          {verTodo && <TablaHorarios horarios={s.horarios} tipoHoy={tipoHoy} />}
        </div>
      ))}

      <button type="button" className="btn btn-plano btn-sm" onClick={() => setVerTodo(!verTodo)} aria-expanded={verTodo}>
        {verTodo ? 'Ocultar los horarios completos' : 'Ver los horarios completos'}
      </button>
      <PieLinea linea={linea} />
    </article>
  );
}

function PieLinea({ linea }) {
  return (
    <p className="tarjeta-meta">
      {linea.nota && <>{linea.nota} </>}
      {linea.fuente && (
        <a href={linea.fuente} target="_blank" rel="noreferrer">
          Horario oficial
        </a>
      )}
      {linea.telefono && (
        <>
          {' · '}
          <a href={`tel:${linea.telefono.replace(/[^\d+]/g, '')}`}>{linea.telefono}</a>
        </>
      )}
      {linea.revisado_en && <> · Revisado el {new Date(linea.revisado_en).toLocaleDateString('es-ES')}</>}
    </p>
  );
}

function AutobusesPage() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/autobuses');
      setDatos(data);
      setError(null);
    } catch {
      setError('No se pudieron cargar los horarios.');
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);
  // Cada minuto: "en 5 min" tiene que ir bajando mientras la página está
  // abierta en la parada. useSondeo para cuando la pestaña no se ve.
  useSondeo(cargar, 60000);

  return (
    <section>
      <CabeceraSeccion ruta="/autobuses" descripcion="El urbano de Lepe y los autobuses de Damas a Huelva, Sevilla y La Antilla." />

      {error && !datos && (
        <div className="aviso aviso-error">
          <Icono nombre="alerta" tam={18} />
          <span>{error}</span>
        </div>
      )}
      {!datos && !error && <EsqueletoFeed cuantas={2} />}

      {datos && (
        <>
          <p className="tarjeta-meta">
            Hoy es {HOY_ES[datos.tipo_dia]} y son las {datos.ahora.hora} en Lepe. En festivos el horario
            cambia: compruébalo con la empresa.
          </p>
          {datos.lineas.map((linea) =>
            linea.tipo === 'urbano' ? (
              <LineaUrbana key={linea.codigo} linea={{ ...linea, ahora: datos.ahora }} tipoHoy={datos.tipo_dia} />
            ) : (
              <LineaInterurbana key={linea.codigo} linea={linea} tipoHoy={datos.tipo_dia} />
            ),
          )}
          <p className="tarjeta-meta">
            Horarios copiados de las webs de las empresas, sin datos en tiempo real: un retraso no aparece aquí.
          </p>
        </>
      )}
    </section>
  );
}

export default AutobusesPage;
