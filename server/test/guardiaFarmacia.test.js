import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ahoraEnMadrid,
  diaDeGuardia,
  esDiaValido,
  esMesValido,
  horaDeCambio,
  limitesDelMes,
  sumarDias,
} from '../src/utils/guardiaFarmacia.js';

// Lógica de fechas pura: no necesita base de datos. Es donde más fácil es
// equivocarse sin darse cuenta (el servidor corre en UTC, las guardias son
// en hora de Madrid) y lo que decide qué farmacia se enseña de madrugada.

test('ahoraEnMadrid usa la hora de Madrid, con horario de verano', () => {
  // 22:30 UTC de octubre = 00:30 del día siguiente en Madrid (UTC+2).
  assert.deepEqual(ahoraEnMadrid(new Date('2026-10-23T22:30:00Z')), { dia: '2026-10-24', hora: '00:30' });
});

test('ahoraEnMadrid usa la hora de Madrid, con horario de invierno', () => {
  // 23:30 UTC de diciembre = 00:30 del 1 de enero en Madrid (UTC+1).
  assert.deepEqual(ahoraEnMadrid(new Date('2026-12-31T23:30:00Z')), { dia: '2027-01-01', hora: '00:30' });
});

test('ahoraEnMadrid no devuelve 24:xx a medianoche', () => {
  const { hora } = ahoraEnMadrid(new Date('2026-10-23T22:00:00Z'));
  assert.equal(hora, '00:00');
});

test('de madrugada la guardia en curso es la del día anterior', () => {
  assert.equal(diaDeGuardia({ dia: '2026-10-24', hora: '03:00' }, '09:30'), '2026-10-23');
  assert.equal(diaDeGuardia({ dia: '2026-10-24', hora: '09:29' }, '09:30'), '2026-10-23');
});

test('desde la hora de cambio manda el día del calendario', () => {
  assert.equal(diaDeGuardia({ dia: '2026-10-24', hora: '09:30' }, '09:30'), '2026-10-24');
  assert.equal(diaDeGuardia({ dia: '2026-10-24', hora: '23:59' }, '09:30'), '2026-10-24');
});

test('la madrugada del 1 de enero pertenece a la guardia del 31 de diciembre', () => {
  assert.equal(diaDeGuardia({ dia: '2027-01-01', hora: '02:00' }, '09:30'), '2026-12-31');
});

test('con la hora de cambio 00:00 se desactiva el desfase', () => {
  assert.equal(diaDeGuardia({ dia: '2026-10-24', hora: '00:00' }, '00:00'), '2026-10-24');
  assert.equal(diaDeGuardia({ dia: '2026-10-24', hora: '03:00' }, '00:00'), '2026-10-24');
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

test('esMesValido', () => {
  assert.equal(esMesValido('2026-10'), true);
  assert.equal(esMesValido('2026-00'), false);
  assert.equal(esMesValido('2026-13'), false);
  assert.equal(esMesValido('2026-1'), false);
  assert.equal(esMesValido('2026-10-01'), false);
});

test('limitesDelMes', () => {
  assert.deepEqual(limitesDelMes('2026-10'), { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.deepEqual(limitesDelMes('2028-02'), { desde: '2028-02-01', hasta: '2028-02-29' });
  assert.deepEqual(limitesDelMes('2027-02'), { desde: '2027-02-01', hasta: '2027-02-28' });
  assert.deepEqual(limitesDelMes('2026-12'), { desde: '2026-12-01', hasta: '2026-12-31' });
});

test('horaDeCambio: por defecto 09:30, configurable y a prueba de valores raros', () => {
  const guardada = process.env.FARMACIA_HORA_CAMBIO;
  try {
    delete process.env.FARMACIA_HORA_CAMBIO;
    assert.equal(horaDeCambio(), '09:30');

    process.env.FARMACIA_HORA_CAMBIO = '09:00';
    assert.equal(horaDeCambio(), '09:00');

    for (const rara of ['9:00', '25:00', 'mañana', '09:60', '']) {
      process.env.FARMACIA_HORA_CAMBIO = rara;
      assert.equal(horaDeCambio(), '09:30', `"${rara}" cae al valor por defecto`);
    }
  } finally {
    if (guardada === undefined) delete process.env.FARMACIA_HORA_CAMBIO;
    else process.env.FARMACIA_HORA_CAMBIO = guardada;
  }
});
