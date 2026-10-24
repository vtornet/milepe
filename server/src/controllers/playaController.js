import ErrorHttp from '../utils/ErrorHttp.js';
import { aSerie, extremosDeMarea, valorMasCercano } from '../utils/mareas.js';
import { ahoraEnMadrid, sumarDias } from '../utils/guardiaFarmacia.js';

// "La playa hoy": mareas, temperatura del agua, oleaje e indice UV en La
// Antilla. Mismo patron que El Tiempo (tiempoController): proxy cacheado, una
// llamada al proveedor sirve a todo el pueblo, y si el proveedor falla se
// sirve lo ultimo que se tenga marcado como obsoleto.
//
// Proveedor: Open-Meteo (marine + forecast). Gratis, sin clave, licencia
// CC BY 4.0: exige citarlo, y el cliente lo cita. Sus mareas son un MODELO
// (no la tabla oficial de Puertos del Estado): valen para saber si sube o
// baja la marea, no para navegar, y el cliente lo dice.

const PLAYA = { nombre: 'La Antilla', lat: 37.203, lon: -7.218 };

const ttlCacheMs = () => Number(process.env.PLAYA_CACHE_MS) || 60 * 60 * 1000;

let cache = { datos: null, expira: 0 };

const pedir = async (base, parametros) => {
  const url = new URL(base);
  url.searchParams.set('latitude', PLAYA.lat);
  url.searchParams.set('longitude', PLAYA.lon);
  for (const [clave, valor] of Object.entries(parametros)) url.searchParams.set(clave, valor);

  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => ({}));
    throw new ErrorHttp(502, `Open-Meteo (${respuesta.status}): ${detalle.reason || 'error desconocido'}`);
  }
  return respuesta.json();
};

const enMadrid = (instante) => ahoraEnMadrid(instante);

export const formatearPlaya = (marino, prevision, ahora = new Date()) => {
  const nivel = aSerie(marino.minutely_15, 'sea_level_height_msl');
  const oleaje = aSerie(marino.hourly, 'wave_height');
  const agua = aSerie(marino.hourly, 'sea_surface_temperature');

  const hoy = enMadrid(ahora).dia;
  const manana = sumarDias(hoy, 1);

  const mareas = extremosDeMarea(nivel)
    .map((m) => ({ ...m, ...enMadrid(m.instante) }))
    .filter((m) => m.dia === hoy || m.dia === manana)
    .map(({ tipo, instante, altura, dia, hora }) => ({ tipo, instante: instante.toISOString(), dia, hora, altura }));

  const proxima = mareas.find((m) => new Date(m.instante) > ahora) || null;

  const oleajeDeHoy = oleaje.filter((p) => enMadrid(p.instante).dia === hoy && typeof p.valor === 'number');
  const uvHoy = prevision?.daily?.time?.indexOf(hoy);

  const redondear = (v, decimales = 1) => (typeof v === 'number' ? Math.round(v * 10 ** decimales) / 10 ** decimales : null);

  return {
    playa: PLAYA.nombre,
    mareas,
    proxima_marea: proxima,
    agua_c: redondear(valorMasCercano(agua, ahora)),
    oleaje_m: redondear(valorMasCercano(oleaje, ahora)),
    oleaje_max_hoy_m: oleajeDeHoy.length ? redondear(Math.max(...oleajeDeHoy.map((p) => p.valor))) : null,
    uv_max_hoy: uvHoy >= 0 ? redondear(prevision.daily.uv_index_max[uvHoy]) : null,
    actualizado: ahora.toISOString(),
  };
};

export const obtenerPlaya = async (req, res, next) => {
  try {
    if (cache.datos && Date.now() < cache.expira) {
      res.json({ ok: true, playa: cache.datos, cacheado: true });
      return;
    }

    let marino;
    let prevision;
    try {
      [marino, prevision] = await Promise.all([
        pedir('https://marine-api.open-meteo.com/v1/marine', {
          minutely_15: 'sea_level_height_msl',
          hourly: 'wave_height,sea_surface_temperature',
          timezone: 'GMT',
          // Un dia atras para encontrar el extremo que cae justo al empezar hoy.
          past_days: 1,
          forecast_days: 3,
        }),
        pedir('https://api.open-meteo.com/v1/forecast', {
          daily: 'uv_index_max',
          timezone: 'Europe/Madrid',
          forecast_days: 2,
        }),
      ]);
    } catch (error) {
      if (cache.datos) {
        res.json({ ok: true, playa: cache.datos, cacheado: true, obsoleto: true });
        return;
      }
      throw error;
    }

    const datos = formatearPlaya(marino, prevision);
    cache = { datos, expira: Date.now() + ttlCacheMs() };
    res.json({ ok: true, playa: datos, cacheado: false });
  } catch (error) {
    next(error);
  }
};

// Solo para tests.
export const _vaciarCachePlaya = () => {
  cache = { datos: null, expira: 0 };
};
