import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { arrancar } from './ayuda.js';
import { tipoDeDia, proximasSalidas, sumarMinutos } from '../src/utils/horarioAutobus.js';

const horarios = { laborables: ['07:00', '08:00', '13:50', '19:50'], sabados: ['09:00'], domingos: [] };

test('el tipo de día sale del calendario, no del reloj del servidor', () => {
  assert.equal(tipoDeDia('2026-10-26'), 'laborables'); // lunes
  assert.equal(tipoDeDia('2026-10-30'), 'laborables'); // viernes
  assert.equal(tipoDeDia('2026-10-31'), 'sabados');
  assert.equal(tipoDeDia('2026-10-25'), 'domingos'); // el del cambio de hora
});

test('próximas salidas: las de hoy desde este minuto, con lo que falta', () => {
  const r = proximasSalidas(horarios, { ahora: { dia: '2026-10-26', hora: '08:00' } });
  assert.deepEqual(r.hoy, [
    { hora: '08:00', faltan_min: 0 },
    { hora: '13:50', faltan_min: 350 },
    { hora: '19:50', faltan_min: 710 },
  ]);
  assert.equal(r.siguiente, null);
  assert.equal(proximasSalidas(horarios, { cuantas: 1, ahora: { dia: '2026-10-26', hora: '07:01' } }).hoy.length, 1);
});

test('si hoy ya no quedan, la primera del siguiente día con servicio', () => {
  // Viernes por la noche: mañana sábado.
  assert.deepEqual(proximasSalidas(horarios, { ahora: { dia: '2026-10-30', hora: '22:00' } }).siguiente, {
    dia: '2026-10-31',
    hora: '09:00',
    es_manana: true,
  });
  // Sábado por la noche: el domingo no hay, el lunes sí.
  assert.deepEqual(proximasSalidas(horarios, { ahora: { dia: '2026-10-31', hora: '10:00' } }).siguiente, {
    dia: '2026-11-02',
    hora: '07:00',
    es_manana: false,
  });
  // Sin ningún horario, nada (y no se queda en bucle).
  assert.deepEqual(proximasSalidas({}, { ahora: { dia: '2026-10-31', hora: '10:00' } }), { hoy: [], siguiente: null });
});

test('sumar minutos para las paradas del urbano', () => {
  assert.equal(sumarMinutos('07:30', 20), '07:50');
  assert.equal(sumarMinutos('13:00', 4), '13:04');
});

test('el fichero de datos es válido: horas ordenadas y paradas del urbano coherentes', async () => {
  const { lineas } = JSON.parse(fs.readFileSync(new URL('../scripts/datos/autobuses.json', import.meta.url), 'utf8'));
  for (const l of lineas) {
    for (const s of l.sentidos) {
      for (const lista of Object.values(s.horarios)) {
        assert.deepEqual(lista, [...lista].sort(), `${l.codigo} ${s.desde}`);
        assert.ok(lista.every((h) => /^\d{2}:\d{2}$/.test(h)));
      }
    }
  }
  const urbano = lineas.find((l) => l.codigo === 'urbano-lepe');
  assert.equal(urbano.paradas[0].minutos, 0);
  assert.ok(urbano.paradas.every((p, i) => i === 0 || p.minutos > urbano.paradas[i - 1].minutos));
  assert.deepEqual(urbano.sentidos[0].horarios.sabados, []);
});

let t;
before(async () => {
  t = await arrancar();
});
after(() => t.detener());

test('GET /autobuses: líneas activas en orden, con las próximas ya calculadas', async () => {
  const { default: LineaAutobus } = await import('../src/models/LineaAutobus.js');
  await LineaAutobus.create([
    { codigo: 'b', nombre: 'Lepe – Huelva', operador: 'Damas', tipo: 'interurbano', orden: 2, sentidos: [{ desde: 'Lepe', hacia: 'Huelva', horarios }] },
    { codigo: 'a', nombre: 'Urbano', operador: 'Gonca', tipo: 'urbano', orden: 1, sentidos: [], paradas: [{ nombre: 'Centro de Salud', minutos: 0 }] },
    { codigo: 'c', nombre: 'Retirada', operador: 'X', tipo: 'interurbano', orden: 0, activa: false },
  ]);
  await assert.rejects(
    LineaAutobus.create({ codigo: 'd', nombre: 'Mal', operador: 'X', tipo: 'urbano', sentidos: [{ desde: 'a', hacia: 'b', horarios: { laborables: ['9:00'] } }] }),
    /HH:MM/,
  );

  const r = await t.api.get('/autobuses');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.lineas.map((l) => l.codigo), ['a', 'b']);
  assert.match(r.body.ahora.dia, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(['laborables', 'sabados', 'domingos'].includes(r.body.tipo_dia));
  const p = r.body.lineas[1].sentidos[0].proximas;
  assert.ok(Array.isArray(p.hoy));
  assert.ok(p.hoy.length > 0 || p.siguiente, 'o quedan hoy o dice cuándo es la siguiente');
});

test('sincronizar desde el fichero: carga si está vacío o es más nuevo, y no repite si no', async () => {
  const { sincronizarAutobuses, leerFichero } = await import('../src/utils/cargarAutobuses.js');
  const { default: LineaAutobus } = await import('../src/models/LineaAutobus.js');
  await LineaAutobus.deleteMany({});
  const datos = leerFichero();

  assert.deepEqual(await sincronizarAutobuses(), { cargadas: datos.lineas.length, desactivadas: 0 });
  assert.equal(await sincronizarAutobuses(), null, 'misma fecha: no vuelve a cargar');

  const r = await t.api.get('/autobuses');
  assert.equal(r.body.lineas[0].codigo, 'urbano-lepe');
  assert.equal(r.body.lineas.length, datos.lineas.length);
});
