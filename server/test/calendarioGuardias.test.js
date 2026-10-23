import { test } from 'node:test';
import assert from 'node:assert/strict';
// Es código del cliente, pero puro (sin React ni DOM), así que se prueba aquí
// con el resto de tests: el cliente no tiene ejecutor propio.
import { aDiaISO, interpretarCalendario, interpretarHorario } from '../../client/src/utils/calendarioGuardias.js';

test('aDiaISO normaliza los formatos habituales', () => {
  assert.equal(aDiaISO('2026-10-03'), '2026-10-03');
  assert.equal(aDiaISO('2026-10-3'), '2026-10-03');
  assert.equal(aDiaISO('3/10/2026'), '2026-10-03');
  assert.equal(aDiaISO('03.10.2026'), '2026-10-03');
  assert.equal(aDiaISO('3-1-2027'), '2027-01-03');
});

test('interpretarHorario entiende las formas en que se escribe', () => {
  assert.deepEqual(interpretarHorario('9:30-22:00'), { desde: '09:30', hasta: '22:00' });
  assert.deepEqual(interpretarHorario('de 9:30 a 22:00'), { desde: '09:30', hasta: '22:00' });
  assert.deepEqual(interpretarHorario('De 09:30 A 22:00 horas'), { desde: '09:30', hasta: '22:00' });
  assert.deepEqual(interpretarHorario('24h'), { desde: '00:00', hasta: '24:00' });
  assert.deepEqual(interpretarHorario('24 horas'), { desde: '00:00', hasta: '24:00' });
  assert.deepEqual(interpretarHorario('Todo el día'), { desde: '00:00', hasta: '24:00' });
  assert.equal(interpretarHorario('turno especial'), null);
});

// --- Guardias con fecha ---

test('interpreta líneas con fecha: punto y coma, tabulador, barra y coma', () => {
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

test('la tercera columna es el horario si lo parece y una nota si no', () => {
  const { guardias } = interpretarCalendario('03/10/2026;Farmacia A;de 9:30 a 22:00\n04/10/2026;Farmacia B;Turno especial');
  assert.deepEqual(guardias, [
    { dia: '2026-10-03', farmacia: 'Farmacia A', desde: '09:30', hasta: '22:00' },
    { dia: '2026-10-04', farmacia: 'Farmacia B', nota: 'Turno especial' },
  ]);
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

test('un nombre con coma se conserva si se separa con punto y coma', () => {
  const { guardias } = interpretarCalendario('2026-10-01;Farmacia Pérez, S.L.;Turno de día');
  assert.deepEqual(guardias, [{ dia: '2026-10-01', farmacia: 'Farmacia Pérez, S.L.', nota: 'Turno de día' }]);
});

// --- Patrón semanal (el formato real del cuadro de Lepe) ---

// Octubre de 2026 empieza en jueves y el lunes 12 es festivo.
const CUADRO_LEPE = [
  'L-V;Farmacia A;9:30-22:00',
  'L-V;Farmacia B;9:30-22:00',
  'L-V;Farmacia C;9:30-22:00',
  'S;Farmacia A;9:30-22:00',
  'S;Farmacia C;9:30-22:00',
  'D;Farmacia A;9:30-22:00',
  'festivos;Farmacia A;9:30-22:00',
  'todos;Farmacia Vacas;24h',
  'festivo;12/10/2026',
].join('\n');

const delDia = (guardias, dia) => guardias.filter((g) => g.dia === dia).map((g) => g.farmacia).sort();

test('el patrón semanal se expande a los 31 días de octubre', () => {
  const { guardias, errores } = interpretarCalendario(CUADRO_LEPE, '2026-10');
  assert.deepEqual(errores, []);

  // Jueves 1: entre semana.
  assert.deepEqual(delDia(guardias, '2026-10-01'), ['Farmacia A', 'Farmacia B', 'Farmacia C', 'Farmacia Vacas']);
  // Sábado 3.
  assert.deepEqual(delDia(guardias, '2026-10-03'), ['Farmacia A', 'Farmacia C', 'Farmacia Vacas']);
  // Domingo 4.
  assert.deepEqual(delDia(guardias, '2026-10-04'), ['Farmacia A', 'Farmacia Vacas']);
});

test('un festivo entre semana usa solo las líneas de festivos y de todos, no las de su día', () => {
  const { guardias } = interpretarCalendario(CUADRO_LEPE, '2026-10');
  // Lunes 12 de octubre: no hay B ni C, que son de lunes a viernes.
  assert.deepEqual(delDia(guardias, '2026-10-12'), ['Farmacia A', 'Farmacia Vacas']);
});

test('cada día tiene la de 24 horas y las demás llevan su horario', () => {
  const { guardias } = interpretarCalendario(CUADRO_LEPE, '2026-10');
  const dias = new Set(guardias.map((g) => g.dia));
  assert.equal(dias.size, 31);

  for (const dia of dias) {
    const vacas = guardias.find((g) => g.dia === dia && g.farmacia === 'Farmacia Vacas');
    assert.deepEqual([vacas.desde, vacas.hasta], ['00:00', '24:00'], dia);
  }
  const a = guardias.find((g) => g.dia === '2026-10-01' && g.farmacia === 'Farmacia A');
  assert.deepEqual([a.desde, a.hasta], ['09:30', '22:00']);
});

test('total de guardias de octubre: 21 laborables x4, 4 sábados x3, 4 domingos y 1 festivo x2', () => {
  // Octubre 2026: 22 días de lunes a viernes (uno es festivo, el 12), 5 sábados
  // (3,10,17,24,31), 4 domingos (4,11,18,25). Laborables = 22 - 1 = 21.
  const { guardias } = interpretarCalendario(CUADRO_LEPE, '2026-10');
  assert.equal(guardias.length, 21 * 4 + 5 * 3 + 4 * 2 + 1 * 2);
});

test('las combinaciones de días: L-S, L-D, S+D y "todos"', () => {
  const texto = ['L-S;A', 'S+D;B', 'L-D;C'].join('\n');
  const { guardias } = interpretarCalendario(texto, '2026-10');
  assert.deepEqual(delDia(guardias, '2026-10-05'), ['A', 'C']); // lunes
  assert.deepEqual(delDia(guardias, '2026-10-03'), ['A', 'B', 'C']); // sábado
  assert.deepEqual(delDia(guardias, '2026-10-04'), ['B', 'C']); // domingo
});

test('un patrón sin mes elegido avisa en vez de no hacer nada', () => {
  const { guardias, errores } = interpretarCalendario('L-V;Farmacia A');
  assert.equal(guardias.length, 0);
  assert.match(errores[0], /no se ha elegido el mes/);
});

test('un festivo de otro mes se avisa', () => {
  const { errores } = interpretarCalendario('L-V;A\nfestivo;2026-11-01', '2026-10');
  assert.match(errores[0], /no es de 2026-10/);
});

test('se pueden mezclar patrón y días sueltos', () => {
  const { guardias } = interpretarCalendario('L-V;A\n2026-10-03;Refuerzo;9:30-14:00', '2026-10');
  assert.deepEqual(delDia(guardias, '2026-10-03'), ['Refuerzo']);
  assert.deepEqual(guardias.find((g) => g.farmacia === 'Refuerzo'), {
    dia: '2026-10-03',
    farmacia: 'Refuerzo',
    desde: '09:30',
    hasta: '14:00',
  });
});
