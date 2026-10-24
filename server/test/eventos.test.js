import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar } from './ayuda.js';
import { escaparTexto, eventoAIcs, fechaIcs, plegarLinea } from '../src/utils/calendarioIcs.js';

// --- iCalendar (sin base de datos) ---

test('escapa los caracteres especiales de iCalendar', () => {
  assert.equal(escaparTexto('Feria, música; y \\ más\nsegunda línea'), 'Feria\\, música\\; y \\\\ más\\nsegunda línea');
});

test('las fechas van en UTC con Z', () => {
  assert.equal(fechaIcs('2026-08-15T20:30:00+02:00'), '20260815T183000Z');
});

test('pliega las líneas largas a 75 octetos, contando la ñ como dos', () => {
  const larga = `SUMMARY:${'ñ'.repeat(60)}`;
  const plegada = plegarLinea(larga);
  for (const trozo of plegada.split('\r\n')) assert.ok(Buffer.byteLength(trozo, 'utf8') <= 75, trozo);
  assert.equal(plegada.replace(/\r\n /g, ''), larga, 'desplegada es la misma');
});

test('un evento sin fecha de fin dura dos horas, y el fichero usa CRLF', () => {
  const ics = eventoAIcs({ id: 'abc', titulo: 'Concierto', descripcion: 'x', lugar: 'Plaza', inicio: '2026-08-15T20:00:00Z' });
  assert.match(ics, /DTSTART:20260815T200000Z\r\n/);
  assert.match(ics, /DTEND:20260815T220000Z\r\n/);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.match(ics, /UID:abc@milepe\.com/);
});

// --- API ---

let t;
let ana;
let beto;
let id;

before(async () => {
  t = await arrancar();
  ana = await t.crearUsuario();
  beto = await t.crearUsuario();
  const r = await t.api.post(
    '/eventos',
    { titulo: 'Verbena, en la plaza', contenido: 'Música; baile', categoria: 'fiesta_patronal', lugar: 'Plaza de España', fecha_inicio: '2099-08-15T20:00:00Z' },
    { token: ana.token },
  );
  id = r.body.evento._id;
});
after(() => t.detener());

const asistir = (quien) => t.api.post(`/eventos/${id}/asistir`, {}, { token: quien.token });

test('"voy a ir" alterna y cuenta bien, también con dos personas', async () => {
  assert.deepEqual((await asistir(ana)).body, { ok: true, voy: true, asistentes: 1 });
  assert.equal((await asistir(beto)).body.asistentes, 2);
  assert.deepEqual((await asistir(ana)).body, { ok: true, voy: false, asistentes: 1 });

  const enAgenda = (await t.api.get('/eventos')).body.eventos.find((e) => e._id === id);
  assert.equal(enAgenda.asistentes, 1);
});

test('dos pulsaciones simultáneas no cuentan dos veces', async () => {
  await Promise.all([asistir(ana), asistir(ana)]);
  const { asistentes } = (await t.api.get(`/eventos/${id}`)).body.evento;
  const filas = await t.mongoose.model('AsistenciaEvento').countDocuments({ post_id: id });
  assert.equal(asistentes, filas, 'el contador coincide con las filas reales');
});

test('mis asistencias y permisos', async () => {
  assert.equal((await t.api.get('/eventos/mis-asistencias')).status, 401);
  assert.equal((await t.api.post(`/eventos/${id}/asistir`)).status, 401);
  const mias = (await t.api.get('/eventos/mis-asistencias', { token: beto.token })).body.eventos;
  assert.deepEqual(mias, [id]);
});

test('el .ics se descarga sin cuenta, con el evento bien escapado', async () => {
  const respuesta = await t.api.get(`/eventos/${id}/calendario.ics`);
  assert.equal(respuesta.status, 200);
  assert.match(respuesta.cabeceras.get('content-type'), /text\/calendar/);
  assert.match(respuesta.body, /SUMMARY:Verbena\\, en la plaza/);
  assert.match(respuesta.body, /DESCRIPTION:Música\\; baile/);
  assert.match(respuesta.body, /DTSTART:20990815T200000Z/);
});

test('el .ics de algo que no es un evento es 404', async () => {
  const queja = await t.api.post('/quejas', { titulo: 'Q', contenido: 'x', categoria: 'obras', ubicacion: { lat: 37.25, lng: -7.2 } }, { token: ana.token });
  assert.equal((await t.api.get(`/eventos/${queja.body.queja._id}/calendario.ics`)).status, 404);
});
