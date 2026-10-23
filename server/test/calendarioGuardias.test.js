import { test } from 'node:test';
import assert from 'node:assert/strict';
// Es código del cliente, pero puro (sin React ni DOM), así que se prueba aquí
// con el resto de tests: el cliente no tiene ejecutor propio.
import { aDiaISO, interpretarCalendario } from '../../client/src/utils/calendarioGuardias.js';

test('aDiaISO normaliza los formatos habituales', () => {
  assert.equal(aDiaISO('2026-10-03'), '2026-10-03');
  assert.equal(aDiaISO('2026-10-3'), '2026-10-03');
  assert.equal(aDiaISO('3/10/2026'), '2026-10-03');
  assert.equal(aDiaISO('03.10.2026'), '2026-10-03');
  assert.equal(aDiaISO('3-1-2027'), '2027-01-03');
});

test('interpreta líneas con punto y coma, tabulador, barra y coma', () => {
  const { guardias, errores } = interpretarCalendario(
    ['2026-10-01;Farmacia Pérez', '02/10/2026\tFarmacia La Antilla', '3/10/2026|Farmacia Islantilla', '2026-10-04,Farmacia Pérez'].join('\n'),
  );
  assert.deepEqual(errores, []);
  assert.deepEqual(guardias, [
    { dia: '2026-10-01', farmacia: 'Farmacia Pérez' },
    { dia: '2026-10-02', farmacia: 'Farmacia La Antilla' },
    { dia: '2026-10-03', farmacia: 'Farmacia Islantilla' },
    { dia: '2026-10-04', farmacia: 'Farmacia Pérez' },
  ]);
});

test('la tercera columna es la nota del turno', () => {
  const { guardias } = interpretarCalendario('03/10/2026;Farmacia La Antilla;De 9:30 a 22:00');
  assert.deepEqual(guardias, [{ dia: '2026-10-03', farmacia: 'Farmacia La Antilla', nota: 'De 9:30 a 22:00' }]);
});

test('ignora líneas vacías, espacios sobrantes, CRLF y la cabecera', () => {
  const { guardias, errores } = interpretarCalendario('Fecha;Farmacia\r\n\r\n  2026-10-01 ;  Farmacia Pérez  \r\n   \r\n');
  assert.deepEqual(errores, []);
  assert.deepEqual(guardias, [{ dia: '2026-10-01', farmacia: 'Farmacia Pérez' }]);
});

test('lo que no se entiende se devuelve con su número de línea, no se descarta', () => {
  const { guardias, errores } = interpretarCalendario('2026-10-01;Farmacia Pérez\nhoy;Farmacia X\n2026-10-03');
  assert.equal(guardias.length, 1);
  assert.equal(errores.length, 2);
  assert.match(errores[0], /Línea 2/);
  assert.match(errores[1], /Línea 3/);
});

test('un nombre con coma en su interior se conserva si se separa con punto y coma', () => {
  const { guardias } = interpretarCalendario('2026-10-01;Farmacia Pérez, S.L.;Turno de día');
  assert.deepEqual(guardias, [{ dia: '2026-10-01', farmacia: 'Farmacia Pérez, S.L.', nota: 'Turno de día' }]);
});
