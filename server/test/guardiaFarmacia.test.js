import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ahoraEnMadrid,
  esDiaValido,
  esHoraFinValida,
  esHoraValida,
  esMesValido,
  estaEnCurso,
  limitesDelMes,
  sumarDias,
  ventanaDeGuardia,
} from '../src/utils/guardiaFarmacia.js';

// Lógica de fechas y horarios pura: no necesita base de datos. Es donde más
// fácil es equivocarse sin darse cuenta (el servidor corre en UTC, las
// guardias son en hora de Madrid) y lo que decide qué farmacia se enseña de
// madrugada.

test('ahoraEnMadrid usa la hora de Madrid, con horario de verano', () => {
  // 22:30 UTC de octubre = 00:30 del día siguiente en Madrid (UTC+2).
  assert.deepEqual(ahoraEnMadrid(new Date('2026-10-23T22:30:00Z')), { dia: '2026-10-24', hora: '00:30' });
});

test('ahoraEnMadrid usa la hora de Madrid, con horario de invierno', () => {
  // 23:30 UTC de diciembre = 00:30 del 1 de enero en Madrid (UTC+1).
  assert.deepEqual(ahoraEnMadrid(new Date('2026-12-31T23:30:00Z')), { dia: '2027-01-01', hora: '00:30' });
});

test('ahoraEnMadrid no devuelve 24:xx a medianoche', () => {
  assert.equal(ahoraEnMadrid(new Date('2026-10-23T22:00:00Z')).hora, '00:00');
});

test('sumarDias cruza meses, años y años bisiestos', () => {
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(sumarDias('2028-02-28', 1), '2028-02-29');
  assert.equal(sumarDias('2027-02-28', 1), '2027-03-01');
  assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(sumarDias('2026-10-24', 0), '2026-10-24');
});

test('esDiaValido rechaza fechas que el formato deja pasar', () => {
  assert.equal(esDiaValido('2028-02-29'), true);
  assert.equal(esDiaValido('2026-02-29'), false);
  assert.equal(esDiaValido('2026-02-30'), false);
  assert.equal(esDiaValido('2026-13-01'), false);
  assert.equal(esDiaValido('2026-2-3'), false);
  assert.equal(esDiaValido('mañana'), false);
  assert.equal(esDiaValido(undefined), false);
  assert.equal(esDiaValido(20261024), false);
});

test('esMesValido y limitesDelMes', () => {
  assert.equal(esMesValido('2026-10'), true);
  assert.equal(esMesValido('2026-00'), false);
  assert.equal(esMesValido('2026-13'), false);
  assert.equal(esMesValido('2026-1'), false);
  assert.equal(esMesValido('2026-10-01'), false);
  assert.deepEqual(limitesDelMes('2026-10'), { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.deepEqual(limitesDelMes('2028-02'), { desde: '2028-02-01', hasta: '2028-02-29' });
  assert.deepEqual(limitesDelMes('2027-02'), { desde: '2027-02-01', hasta: '2027-02-28' });
});

test('las horas: 24:00 solo vale como fin', () => {
  assert.equal(esHoraValida('09:30'), true);
  assert.equal(esHoraValida('24:00'), false);
  assert.equal(esHoraValida('9:30'), false);
  assert.equal(esHoraValida('09:60'), false);
  assert.equal(esHoraFinValida('24:00'), true);
  assert.equal(esHoraFinValida('22:00'), true);
  assert.equal(esHoraFinValida('25:00'), false);
});

// --- Ventanas de guardia ---

const diurna = { dia: '2026-10-05', desde: '09:30', hasta: '22:00' };
const veinticuatro = { dia: '2026-10-05', desde: '00:00', hasta: '24:00' };

test('una guardia diurna solo está en curso dentro de su horario', () => {
  const a = (dia, hora) => estaEnCurso(diurna, { dia, hora });

  assert.equal(a('2026-10-05', '09:29'), false);
  assert.equal(a('2026-10-05', '09:30'), true);
  assert.equal(a('2026-10-05', '15:00'), true);
  assert.equal(a('2026-10-05', '21:59'), true);
  assert.equal(a('2026-10-05', '22:00'), false);
});

test('de madrugada una farmacia diurna del día anterior está CERRADA, no de guardia', () => {
  // El caso que motivó el diseño: a las 3 de la mañana del día 6, la
  // guardia diurna del día 5 no cuenta.
  assert.equal(estaEnCurso(diurna, { dia: '2026-10-06', hora: '03:00' }), false);
  assert.equal(estaEnCurso(diurna, { dia: '2026-10-06', hora: '09:35' }), false);
});

test('una guardia de 24 horas cubre todo su día, madrugada incluida', () => {
  assert.equal(estaEnCurso(veinticuatro, { dia: '2026-10-05', hora: '00:00' }), true);
  assert.equal(estaEnCurso(veinticuatro, { dia: '2026-10-05', hora: '03:00' }), true);
  assert.equal(estaEnCurso(veinticuatro, { dia: '2026-10-05', hora: '23:59' }), true);
  assert.equal(estaEnCurso(veinticuatro, { dia: '2026-10-06', hora: '00:00' }), false, 'ese día lo cubre la fila del día 6');
  assert.equal(estaEnCurso(veinticuatro, { dia: '2026-10-04', hora: '23:59' }), false);
});

test('sin horario, la guardia vale todo el día', () => {
  assert.equal(estaEnCurso({ dia: '2026-10-05' }, { dia: '2026-10-05', hora: '04:00' }), true);
});

test('una guardia de noche (22:00 a 09:30) acaba al día siguiente', () => {
  const noche = { dia: '2026-10-05', desde: '22:00', hasta: '09:30' };

  assert.equal(estaEnCurso(noche, { dia: '2026-10-05', hora: '21:59' }), false);
  assert.equal(estaEnCurso(noche, { dia: '2026-10-05', hora: '23:00' }), true);
  assert.equal(estaEnCurso(noche, { dia: '2026-10-06', hora: '03:00' }), true);
  assert.equal(estaEnCurso(noche, { dia: '2026-10-06', hora: '09:29' }), true);
  assert.equal(estaEnCurso(noche, { dia: '2026-10-06', hora: '09:30' }), false);
});

test('"09:30 a 09:30" son 24 horas seguidas', () => {
  const dia24 = { dia: '2026-10-05', desde: '09:30', hasta: '09:30' };
  const { inicio, fin } = ventanaDeGuardia(dia24);
  assert.equal(fin - inicio, 24 * 60);
  assert.equal(estaEnCurso(dia24, { dia: '2026-10-06', hora: '09:29' }), true);
  assert.equal(estaEnCurso(dia24, { dia: '2026-10-06', hora: '09:30' }), false);
});

test('la noche del 31 de diciembre al 1 de enero cruza el año', () => {
  const noche = { dia: '2026-12-31', desde: '22:00', hasta: '09:30' };
  assert.equal(estaEnCurso(noche, { dia: '2027-01-01', hora: '02:00' }), true);
});

test('el cambio de hora de octubre no desplaza las guardias (se razona en hora local)', () => {
  // El 25 de octubre de 2026 se atrasa el reloj; el día tiene 25 h reales,
  // pero para el calendario sigue siendo "el 25".
  const dia = { dia: '2026-10-25', desde: '09:30', hasta: '22:00' };
  assert.equal(estaEnCurso(dia, { dia: '2026-10-25', hora: '10:00' }), true);
  assert.equal(estaEnCurso(dia, { dia: '2026-10-25', hora: '22:00' }), false);
});
