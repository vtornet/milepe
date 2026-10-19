import ErrorHttp from '../utils/ErrorHttp.js';

// Lepe (Huelva). La seccion El Tiempo no tiene contenido de usuario ni
// toca Mongo: es un proxy a OpenWeather. El proxy existe por dos razones,
// no solo una: la clave nunca viaja al navegador, y todos los vecinos
// consultan el mismo pueblo, asi que una sola llamada sirve para todos.
const COORDENADAS_LEPE = { lat: 37.2545, lon: -7.2039 };

const BASE_OPENWEATHER = 'https://api.openweathermap.org/data/2.5';

// 10 minutos: el tiempo no cambia mas rapido que eso, y asi un pueblo
// entero refrescando la pagina no consume la cuota gratuita (que se mide
// por llamadas, no por usuarios). Se lee en cada peticion, no al importar
// el modulo, para poder ajustarlo sin reiniciar y -sobre todo- para que
// las pruebas puedan acortarlo y ejercitar de verdad el camino de
// "cache caducada + proveedor caido".
const ttlCacheMs = () => Number(process.env.TIEMPO_CACHE_MS) || 10 * 60 * 1000;

// Cache en memoria del proceso. Suficiente a esta escala: un solo pueblo,
// un solo servidor. Si algun dia hay varias instancias, esto pasaria a
// Redis o a una coleccion con TTL, pero montar eso ahora seria pagar
// complejidad por un problema que no tenemos.
let cache = { datos: null, expira: 0 };

const pedirAOpenWeather = async (recurso, apiKey) => {
  const url = new URL(`${BASE_OPENWEATHER}/${recurso}`);
  url.searchParams.set('lat', COORDENADAS_LEPE.lat);
  url.searchParams.set('lon', COORDENADAS_LEPE.lon);
  url.searchParams.set('units', 'metric');
  url.searchParams.set('lang', 'es');
  url.searchParams.set('appid', apiKey);

  const respuesta = await fetch(url);

  if (!respuesta.ok) {
    // El cuerpo de error de OpenWeather trae un "message" util (clave
    // invalida, clave aun sin activar, cuota agotada...). Se propaga tal
    // cual porque diagnostica mucho mejor que un 502 generico.
    const detalle = await respuesta.json().catch(() => ({}));
    throw new ErrorHttp(502, `OpenWeather (${respuesta.status}): ${detalle.message || 'error desconocido'}`);
  }

  return respuesta.json();
};

// Convierte la respuesta de OpenWeather a la forma que usa el cliente. Se
// traduce aqui a proposito (mismo criterio que geo.js con GeoJSON): si
// algun dia se cambia de proveedor o AEMET, solo cambia este archivo, no
// el cliente.
const formatearActual = (datos) => ({
  temperatura: Math.round(datos.main.temp),
  sensacion: Math.round(datos.main.feels_like),
  descripcion: datos.weather[0]?.description || '',
  icono: datos.weather[0]?.icon || null,
  humedad: datos.main.humidity,
  // OpenWeather da el viento en m/s con units=metric; km/h se entiende
  // mejor en una app para vecinos.
  viento_kmh: Math.round(datos.wind.speed * 3.6),
});

// El endpoint /forecast devuelve 40 tramos de 3 horas, no dias. Hay que
// agruparlos por fecha para sacar minima/maxima de cada dia.
const formatearPrevision = (datos) => {
  const porDia = new Map();

  for (const tramo of datos.list) {
    // dt_txt viene como "2026-10-19 15:00:00" en hora UTC; basta la parte
    // de la fecha para agrupar.
    const fecha = tramo.dt_txt.slice(0, 10);

    if (!porDia.has(fecha)) {
      porDia.set(fecha, { fecha, temp_min: Infinity, temp_max: -Infinity, tramos: [] });
    }

    const dia = porDia.get(fecha);
    dia.temp_min = Math.min(dia.temp_min, tramo.main.temp_min);
    dia.temp_max = Math.max(dia.temp_max, tramo.main.temp_max);
    dia.tramos.push(tramo);
  }

  return [...porDia.values()].map((dia) => {
    // Como icono/descripcion del dia se usa el tramo mas cercano al
    // mediodia: es lo que la gente entiende por "que tiempo hace hoy",
    // mejor que el primer tramo disponible (que de madrugada seria
    // siempre noche).
    const mediodia = dia.tramos.reduce((mejor, tramo) => {
      const hora = Number(tramo.dt_txt.slice(11, 13));
      const mejorHora = Number(mejor.dt_txt.slice(11, 13));
      return Math.abs(hora - 13) < Math.abs(mejorHora - 13) ? tramo : mejor;
    }, dia.tramos[0]);

    return {
      fecha: dia.fecha,
      temp_min: Math.round(dia.temp_min),
      temp_max: Math.round(dia.temp_max),
      descripcion: mediodia.weather[0]?.description || '',
      icono: mediodia.weather[0]?.icon || null,
    };
  });
};

export const obtenerTiempo = async (req, res, next) => {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new ErrorHttp(503, 'El servicio del tiempo no esta configurado (falta OPENWEATHER_API_KEY)');
    }

    if (cache.datos && Date.now() < cache.expira) {
      res.json({ ok: true, tiempo: cache.datos, cacheado: true });
      return;
    }

    let actual;
    let prevision;
    try {
      [actual, prevision] = await Promise.all([
        pedirAOpenWeather('weather', apiKey),
        pedirAOpenWeather('forecast', apiKey),
      ]);
    } catch (error) {
      // Si OpenWeather falla pero tenemos datos viejos, es mucho mejor
      // enseñar el tiempo de hace un rato que un error: a nadie le sirve
      // una pagina rota porque el proveedor tuvo un mal minuto.
      if (cache.datos) {
        res.json({ ok: true, tiempo: cache.datos, cacheado: true, obsoleto: true });
        return;
      }
      throw error;
    }

    const datos = {
      municipio: 'Lepe',
      actual: formatearActual(actual),
      proximos_dias: formatearPrevision(prevision),
      actualizado: new Date().toISOString(),
    };

    cache = { datos, expira: Date.now() + ttlCacheMs() };

    res.json({ ok: true, tiempo: datos, cacheado: false });
  } catch (error) {
    next(error);
  }
};

// Solo para las pruebas: permite vaciar la cache entre casos sin tener que
// esperar al TTL ni reiniciar el proceso.
export const _vaciarCache = () => {
  cache = { datos: null, expira: 0 };
};
