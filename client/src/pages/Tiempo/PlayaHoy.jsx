import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import Icono from '../../components/Icono.jsx';

// Escala de la OMS para el índice UV.
const nivelUV = (uv) => {
  if (uv === null || uv === undefined) return null;
  if (uv < 3) return 'bajo';
  if (uv < 6) return 'moderado';
  if (uv < 8) return 'alto';
  if (uv < 11) return 'muy alto';
  return 'extremo';
};

const NOMBRE_DIA = (dia, hoy) => (dia === hoy ? 'Hoy' : 'Mañana');

// "La playa hoy" en La Antilla: mareas, agua, oleaje y UV. Solo horas para
// las mareas, sin alturas: el modelo las da respecto al nivel medio del mar,
// no al cero de las tablas náuticas, y un "-1,8 m" confunde más que ayuda.
// Reintentos automáticos antes de rendirse: un fallo suelto (la API
// reiniciándose en un despliegue, la cobertura del móvil) no debe dejar la
// sección sin datos hasta que alguien recargue.
const ESPERAS_REINTENTO_MS = [2000, 6000];

function PlayaHoy() {
  const [playa, setPlaya] = useState(null);
  const [error, setError] = useState(false);
  // Cambia para volver a pedir los datos (botón "Reintentar").
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    let temporizador;
    const pedir = (fallos) => {
      api
        .get('/playa')
        .then(({ data }) => {
          if (cancelado) return;
          setPlaya(data.playa);
          setError(false);
        })
        .catch(() => {
          if (cancelado) return;
          if (fallos < ESPERAS_REINTENTO_MS.length) {
            temporizador = setTimeout(() => pedir(fallos + 1), ESPERAS_REINTENTO_MS[fallos]);
          } else {
            setError(true);
          }
        });
    };
    pedir(0);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [intento]);

  // Antes desaparecía sin decir nada si fallaba: parecía que la sección ya no
  // existía.
  if (error && !playa) {
    return (
      <>
        <h2>La playa hoy · La Antilla</h2>
        <article className="tarjeta">
          <p className="tarjeta-meta">No se han podido cargar los datos de la playa ahora mismo.</p>
          <button
            type="button"
            className="btn btn-contorno btn-sm"
            onClick={() => {
              setError(false);
              setIntento((n) => n + 1);
            }}
          >
            Reintentar
          </button>
        </article>
      </>
    );
  }
  if (!playa) return null;

  const hoy = playa.mareas[0]?.dia;
  const dias = [...new Set(playa.mareas.map((m) => m.dia))];
  const uv = nivelUV(playa.uv_max_hoy);

  return (
    <>
      <h2>La playa hoy · {playa.playa}</h2>
      <article className="tarjeta">
        <div className="tarjeta-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--e-4)' }}>
          {playa.agua_c !== null && (
            <span>
              <Icono nombre="gota" tam={14} /> Agua a {playa.agua_c}°
            </span>
          )}
          {playa.oleaje_m !== null && (
            <span>
              Olas de {playa.oleaje_m} m{playa.oleaje_max_hoy_m !== null && ` (hasta ${playa.oleaje_max_hoy_m} m hoy)`}
            </span>
          )}
          {uv && (
            <span>
              Índice UV {playa.uv_max_hoy} ({uv})
            </span>
          )}
        </div>

        {dias.map((dia) => (
          <div key={dia} className="fila" style={{ justifyContent: 'space-between', marginTop: 'var(--e-2)' }}>
            <strong>{NOMBRE_DIA(dia, hoy)}</strong>
            <span>
              {playa.mareas
                .filter((m) => m.dia === dia)
                .map((m) => `${m.tipo === 'pleamar' ? 'Pleamar' : 'Bajamar'} ${m.hora}`)
                .join(' · ')}
            </span>
          </div>
        ))}

        <p className="tarjeta-meta" style={{ marginTop: 'var(--e-3)' }}>
          Mareas estimadas por un modelo, orientativas: no sirven para navegar. Datos marinos de{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>{' '}
          (CC BY 4.0).
        </p>
      </article>
    </>
  );
}

export default PlayaHoy;
