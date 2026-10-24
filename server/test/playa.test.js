import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar } from './ayuda.js';
import { extremosDeMarea, valorMasCercano } from '../src/utils/mareas.js';
import { formatearPlaya, _vaciarCachePlaya } from '../src/controllers/playaController.js';

// Marea sintética: coseno de periodo 12 h 25 min con máximo en t0. Así se
// sabe exactamente dónde deben caer pleamares y bajamares.
const PERIODO_MIN = 745;
const t0 = Date.parse('2026-10-24T03:07:00Z');
const nivel = (ms) => 1.5 * Math.cos((2 * Math.PI * (ms - t0)) / (PERIODO_MIN * 60000));

const serieSintetica = (desde, horas, pasoMin) =>
  Array.from({ length: (horas * 60) / pasoMin + 1 }, (_, i) => {
    const instante = new Date(Date.parse(desde) + i * pasoMin * 60000);
    return { instante, valor: Math.round(nivel(instante.getTime()) * 100) / 100 };
  });

// Bloque con la forma de Open-Meteo (horas UTC sin "Z").
const bloque = (serie, variable) => ({
  time: serie.map((p) => p.instante.toISOString().slice(0, 16)),
  [variable]: serie.map((p) => p.valor),
});

test('encuentra pleamares y bajamares a menos de 3 minutos de las reales', () => {
  const extremos = extremosDeMarea(serieSintetica('2026-10-24T00:00:00Z', 48, 15));
  const pleamares = extremos.filter((e) => e.tipo === 'pleamar');
  const bajamares = extremos.filter((e) => e.tipo === 'bajamar');

  assert.equal(pleamares.length, 4);
  assert.equal(bajamares.length, 4);
  for (const [i, p] of pleamares.entries()) {
    const real = t0 + i * PERIODO_MIN * 60000;
    assert.ok(Math.abs(p.instante - real) < 3 * 60000, `pleamar ${i}: ${p.instante.toISOString()}`);
    assert.ok(Math.abs(p.altura - 1.5) < 0.02);
  }
  for (const b of bajamares) assert.ok(Math.abs(b.altura + 1.5) < 0.02);
});

test('alterna pleamar y bajamar y no duplica en una meseta', () => {
  const meseta = [0, 1, 1, 0, -1, -1, 0].map((valor, i) => ({ instante: new Date(i * 900000), valor }));
  assert.deepEqual(
    extremosDeMarea(meseta).map((e) => e.tipo),
    ['pleamar', 'bajamar'],
  );
});

test('ignora huecos sin dato en la serie', () => {
  const serie = serieSintetica('2026-10-24T00:00:00Z', 12, 15);
  serie[10].valor = null;
  assert.doesNotThrow(() => extremosDeMarea(serie));
});

test('valorMasCercano', () => {
  const serie = [10, 11, null, 13].map((valor, i) => ({ instante: new Date(i * 3600000), valor }));
  assert.equal(valorMasCercano(serie, new Date(0.4 * 3600000)), 10);
  assert.equal(valorMasCercano(serie, new Date(2.1 * 3600000)), 13, 'salta el hueco');
  assert.equal(valorMasCercano([], new Date()), null);
});

test('formatearPlaya: mareas de hoy y mañana en hora de Madrid, la próxima, agua, oleaje y UV', () => {
  const ahora = new Date('2026-10-24T10:00:00Z'); // 12:00 en Madrid
  const nivelSerie = serieSintetica('2026-10-23T00:00:00Z', 96, 15);
  const horaria = serieSintetica('2026-10-23T00:00:00Z', 96, 60);

  const marino = {
    minutely_15: bloque(nivelSerie, 'sea_level_height_msl'),
    hourly: {
      time: horaria.map((p) => p.instante.toISOString().slice(0, 16)),
      wave_height: horaria.map((_, i) => (i % 24) / 10),
      sea_surface_temperature: horaria.map(() => 19.7),
    },
  };
  const prevision = { daily: { time: ['2026-10-24', '2026-10-25'], uv_index_max: [4.7, 3.1] } };

  const playa = formatearPlaya(marino, prevision, ahora);

  assert.ok(playa.mareas.length >= 7 && playa.mareas.length <= 8);
  assert.ok(playa.mareas.every((m) => m.dia === '2026-10-24' || m.dia === '2026-10-25'));
  // La primera pleamar del día: 03:07 UTC = 05:07 en Madrid (verano, UTC+2).
  assert.equal(playa.mareas.find((m) => m.tipo === 'pleamar').hora.slice(0, 4), '05:0');
  assert.ok(new Date(playa.proxima_marea.instante) > ahora);
  assert.equal(playa.agua_c, 19.7);
  assert.equal(playa.uv_max_hoy, 4.7);
  assert.equal(typeof playa.oleaje_m, 'number');
  assert.equal(typeof playa.oleaje_max_hoy_m, 'number');
});

// --- Endpoint, con Open-Meteo simulado ---

let t;
const fetchReal = globalThis.fetch;
let respuestaSimulada;

before(async () => {
  t = await arrancar();
});
after(async () => {
  globalThis.fetch = fetchReal;
  await t.detener();
});
afterEach(() => {
  globalThis.fetch = fetchReal;
});

// Solo se interceptan las llamadas a Open-Meteo: las del test a nuestra API
// siguen yendo por el fetch real.
const simularOpenMeteo = () => {
  globalThis.fetch = (url, ...resto) =>
    String(url).includes('open-meteo.com') ? respuestaSimulada(String(url)) : fetchReal(url, ...resto);
};

const marinoValido = () => {
  const s = serieSintetica(new Date(Date.now() - 86400000).toISOString().slice(0, 13) + ':00:00Z', 96, 15);
  return { minutely_15: bloque(s, 'sea_level_height_msl'), hourly: { time: [], wave_height: [], sea_surface_temperature: [] } };
};

const json = (cuerpo, status = 200) => Promise.resolve(new Response(JSON.stringify(cuerpo), { status }));

test('GET /playa responde y cachea: la segunda vez no llama a Open-Meteo', async () => {
  _vaciarCachePlaya();
  let llamadas = 0;
  respuestaSimulada = (url) => {
    llamadas += 1;
    return json(url.includes('marine') ? marinoValido() : { daily: { time: [], uv_index_max: [] } });
  };
  simularOpenMeteo();

  const primera = await t.api.get('/playa');
  assert.equal(primera.status, 200);
  assert.ok(primera.body.playa.mareas.length > 0);
  assert.equal(llamadas, 2);

  const segunda = await t.api.get('/playa');
  assert.equal(segunda.body.cacheado, true);
  assert.equal(llamadas, 2);
});

test('si Open-Meteo falla con caché, sirve lo último marcado como obsoleto; sin caché, 502', async () => {
  process.env.PLAYA_CACHE_MS = '1';
  try {
    // Llena la caché con una caducidad de 1 ms.
    _vaciarCachePlaya();
    respuestaSimulada = (url) => json(url.includes('marine') ? marinoValido() : { daily: { time: [], uv_index_max: [] } });
    simularOpenMeteo();
    assert.equal((await t.api.get('/playa')).status, 200);

    respuestaSimulada = () => json({ reason: 'caído' }, 500);
    simularOpenMeteo();
    await new Promise((r) => setTimeout(r, 5));

    const conCache = await t.api.get('/playa');
    assert.equal(conCache.status, 200);
    assert.equal(conCache.body.obsoleto, true);

    _vaciarCachePlaya();
    const sinCache = await t.api.get('/playa');
    assert.equal(sinCache.status, 502);
    assert.match(sinCache.body.mensaje, /Open-Meteo \(500\): caído/);
  } finally {
    delete process.env.PLAYA_CACHE_MS;
  }
});
