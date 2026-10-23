import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { arrancar } from './ayuda.js';
import { estaEnCurso } from '../src/utils/guardiaFarmacia.js';
import { cargarCalendarioMes } from '../src/utils/cargarGuardias.js';
import { interpretarCalendario } from '../../client/src/utils/calendarioGuardias.js';

// El cuadro REAL de octubre de 2026 de Lepe ("Farmacias de atención
// continuada"), tal como está en scripts/datos, cargado con el mismo código
// que usa el script de producción. Lo que debe cumplirse viene del PDF del
// Colegio: diurno de 9:30 a 22:00 (lunes a viernes: Sánchez Martín, Perales
// González y Saniger Bernal; sábados: Sánchez Martín y Saniger Bernal;
// domingos y festivos, el 12 de octubre: Sánchez Martín) y una de 24 horas,
// Vacas Barranco, todos los días.

let t;
let turnosDelMes;

const DIRECTORIO = [
  'Farmacia Sánchez Martín',
  'Farmacia Perales González',
  'Farmacia Saniger Bernal',
  'Farmacia Vacas Barranco',
  'Farmacia Sánchez Sánchez', // otra Sánchez: no debe confundirse con la primera
  'Farmacia Prieto Martín y Morán Moliz', // otra "Martín", ídem
];

before(async () => {
  t = await arrancar();
  const admin = await t.crearUsuario({ rol: 'admin' });
  for (const nombre of DIRECTORIO) await t.api.post('/farmacias', { nombre }, { token: admin.token });

  const texto = fs.readFileSync(new URL('../scripts/datos/guardias-lepe-2026-10.txt', import.meta.url), 'utf8');
  const { guardias, errores } = interpretarCalendario(texto, '2026-10');
  assert.deepEqual(errores, []);

  const resultado = await cargarCalendarioMes('2026-10', guardias);
  assert.equal(resultado.guardias, 109);

  turnosDelMes = (await t.api.get('/farmacias/guardias?mes=2026-10')).body.dias;
});
after(() => t.detener());

// Quién está de guardia el `dia` a la `hora`, según lo guardado.
const deGuardia = (dia, hora) => {
  // También cuentan las del día anterior: una ventana puede acabar al día siguiente.
  const ayer = new Date(`${dia}T00:00:00Z`);
  ayer.setUTCDate(ayer.getUTCDate() - 1);
  const claveAyer = ayer.toISOString().slice(0, 10);

  return turnosDelMes
    .filter((d) => d.dia === dia || d.dia === claveAyer)
    .flatMap((d) => d.turnos.map((x) => ({ ...x, dia: d.dia })))
    .filter((x) => estaEnCurso(x, { dia, hora }))
    .map((x) => x.nombre.replace('Farmacia ', ''))
    .sort();
};

test('el mes tiene los 31 días y todos tienen la farmacia de 24 horas', () => {
  assert.equal(turnosDelMes.length, 31);
  for (const d of turnosDelMes) {
    const vacas = d.turnos.find((x) => x.nombre === 'Farmacia Vacas Barranco');
    assert.ok(vacas, d.dia);
    assert.deepEqual([vacas.desde, vacas.hasta], ['00:00', '24:00'], d.dia);
  }
});

test('de madrugada solo está de guardia la de 24 horas, cualquier día', () => {
  for (const dia of ['2026-10-01', '2026-10-03', '2026-10-04', '2026-10-12']) {
    assert.deepEqual(deGuardia(dia, '03:00'), ['Vacas Barranco'], dia);
  }
});

test('un jueves por la tarde: las tres diurnas y la de 24 horas', () => {
  assert.deepEqual(deGuardia('2026-10-01', '15:00'), [
    'Perales González',
    'Saniger Bernal',
    'Sánchez Martín',
    'Vacas Barranco',
  ]);
});

test('un sábado por la tarde: solo Sánchez Martín, Saniger Bernal y la de 24 horas', () => {
  assert.deepEqual(deGuardia('2026-10-03', '12:00'), ['Saniger Bernal', 'Sánchez Martín', 'Vacas Barranco']);
});

test('un domingo por la tarde: Sánchez Martín y la de 24 horas', () => {
  assert.deepEqual(deGuardia('2026-10-04', '12:00'), ['Sánchez Martín', 'Vacas Barranco']);
});

test('el festivo (lunes 12 de octubre) tiene la guardia de festivos, no la de los lunes', () => {
  assert.deepEqual(deGuardia('2026-10-12', '12:00'), ['Sánchez Martín', 'Vacas Barranco']);
  // Y el lunes siguiente, ya laborable, vuelve a la de entre semana.
  assert.deepEqual(deGuardia('2026-10-19', '12:00'), [
    'Perales González',
    'Saniger Bernal',
    'Sánchez Martín',
    'Vacas Barranco',
  ]);
});

test('antes de las 9:30 y desde las 22:00 las diurnas ya no cuentan', () => {
  assert.deepEqual(deGuardia('2026-10-01', '09:29'), ['Vacas Barranco']);
  assert.deepEqual(deGuardia('2026-10-01', '09:30'), ['Perales González', 'Saniger Bernal', 'Sánchez Martín', 'Vacas Barranco']);
  assert.deepEqual(deGuardia('2026-10-01', '21:59').length, 4);
  assert.deepEqual(deGuardia('2026-10-01', '22:00'), ['Vacas Barranco']);
});

test('no se confunden las dos "Sánchez" ni las dos "Martín": solo salen las del cuadro', () => {
  const todas = new Set(turnosDelMes.flatMap((d) => d.turnos.map((x) => x.nombre)));
  assert.deepEqual([...todas].sort(), [
    'Farmacia Perales González',
    'Farmacia Saniger Bernal',
    'Farmacia Sánchez Martín',
    'Farmacia Vacas Barranco',
  ]);
});
