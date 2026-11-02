import { useState } from 'react';
import CabeceraSeccion from '../../components/CabeceraSeccion.jsx';
import Icono from '../../components/Icono.jsx';
import { AMBITOS, ANIOS, FESTIVOS_LEPE } from './festivosLepe.js';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// "Hoy" es el de Lepe, no el del reloj del móvil (puede estar en otro país).
const hoyEnLepe = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });

// Todo en UTC a mediodía: así ni el huso del navegador ni el cambio de hora
// mueven un día.
const fechaUtc = (dia) => new Date(`${dia}T12:00:00Z`);
const diaLegible = (dia) =>
  fechaUtc(dia).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const diasEntre = (desde, hasta) => Math.round((fechaUtc(hasta) - fechaUtc(desde)) / 86400000);
const clave = (anio, mes, dia) => `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

const TODOS = ANIOS.flatMap((a) => FESTIVOS_LEPE[a].festivos).sort((a, b) => a.dia.localeCompare(b.dia));

const cuando = (n) => (n === 1 ? 'mañana' : `en ${n} días`);

function Mes({ anio, mes, porDia, hoy }) {
  // getUTCDay: 0 = domingo; la semana empieza en lunes.
  const huecos = (new Date(Date.UTC(anio, mes, 1)).getUTCDay() + 6) % 7;
  const total = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const celdas = [...Array(huecos).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];

  return (
    <div className="cal-mes">
      <h3>{MESES[mes]}</h3>
      <div className="cal-rejilla">
        {DIAS_SEMANA.map((d) => (
          <span key={d} className="cal-cabeza" aria-hidden="true">
            {d}
          </span>
        ))}
        {celdas.map((d, i) => {
          if (!d) return <span key={`h${i}`} />;
          const k = clave(anio, mes, d);
          const festivo = porDia[k];
          const clases = ['cal-dia'];
          if (i % 7 === 6) clases.push('domingo');
          if (festivo) clases.push(`festivo ${festivo.ambito}`);
          if (k === hoy) clases.push('hoy');
          return (
            <span key={k} className={clases.join(' ')} title={festivo?.nombre}>
              {d}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CalendarioPage() {
  const hoy = hoyEnLepe();
  const anioHoy = Number(hoy.slice(0, 4));
  const [anio, setAnio] = useState(ANIOS.includes(anioHoy) ? anioHoy : ANIOS[ANIOS.length - 1]);

  const datos = FESTIVOS_LEPE[anio];
  const porDia = Object.fromEntries(datos.festivos.map((f) => [f.dia, f]));
  const deHoy = TODOS.find((f) => f.dia === hoy);
  const proximo = TODOS.find((f) => f.dia > hoy);
  // Si el último año cargado ya pasó o se acaba, que no parezca que no hay
  // más festivos: es que no están metidos.
  const sinMas = !proximo;

  return (
    <section>
      <CabeceraSeccion ruta="/calendario" descripcion="Días festivos en Lepe: nacionales, de Andalucía y las fiestas locales." />

      <div className="tarjeta cal-resumen">
        {deHoy && (
          <p>
            <strong>Hoy es festivo:</strong> {deHoy.nombre}.
          </p>
        )}
        {proximo && (
          <p>
            <span className="tarjeta-meta">Próximo festivo</span>
            <br />
            <strong className="cal-proximo">{diaLegible(proximo.dia)}</strong> · {proximo.nombre}{' '}
            <span className="tarjeta-meta">({cuando(diasEntre(hoy, proximo.dia))})</span>
          </p>
        )}
        {sinMas && <p className="tarjeta-meta">Aún no tenemos el calendario del año que viene.</p>}
      </div>

      {ANIOS.length > 1 && (
        <div className="cal-anios" role="tablist" aria-label="Año">
          {ANIOS.map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={a === anio}
              className={a === anio ? 'btn btn-primario btn-sm' : 'btn btn-contorno btn-sm'}
              onClick={() => setAnio(a)}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {datos.localesPendientes && (
        <p className="tarjeta cal-aviso">
          <Icono nombre="aviso" tam={18} /> Las dos fiestas locales de Lepe para {anio} aún no se han publicado. Aquí
          están los festivos nacionales y de Andalucía.
        </p>
      )}

      <ul className="cal-leyenda">
        {Object.entries(AMBITOS).map(([valor, etiqueta]) => (
          <li key={valor}>
            <span className={`cal-muestra ${valor}`} aria-hidden="true" /> {etiqueta}
          </li>
        ))}
      </ul>

      <div className="cal-meses">
        {MESES.map((_, mes) => (
          <Mes key={mes} anio={anio} mes={mes} porDia={porDia} hoy={hoy} />
        ))}
      </div>

      <h2 className="cal-titulo-lista">Festivos de {anio}</h2>
      <ul className="cal-lista">
        {datos.festivos.map((f) => (
          <li key={f.dia} className={f.dia < hoy ? 'pasado' : undefined}>
            <span className={`cal-muestra ${f.ambito}`} aria-hidden="true" />
            <span className="cal-lista-fecha">{diaLegible(f.dia)}</span>
            <span>
              {f.nombre} <span className="tarjeta-meta">· {AMBITOS[f.ambito]}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="tarjeta-meta">
        Fuente: calendario de fiestas laborales de la Junta de Andalucía (BOJA) y fiestas locales del municipio.{' '}
        <a href={datos.fuente} target="_blank" rel="noreferrer">
          Ver la fuente de {anio}
        </a>
        . Algunos convenios o comercios pueden tener otros días; ante la duda, consulta el tuyo.
      </p>
    </section>
  );
}

export default CalendarioPage;
