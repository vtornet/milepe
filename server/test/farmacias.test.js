import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar } from './ayuda.js';
import { ahoraEnMadrid, sumarDias } from '../src/utils/guardiaFarmacia.js';

let t;
let vecino;
let admin;
const farmacia = {};

before(async () => {
  t = await arrancar();
  vecino = await t.crearUsuario();
  admin = await t.crearUsuario({ rol: 'admin' });
});
after(() => t.detener());

const crear = (datos) => t.api.post('/farmacias', datos, { token: admin.token });
const guardarMes = (mes, guardias, quien = admin) => t.api.put(`/farmacias/guardias/${mes}`, { guardias }, { token: quien.token });
const delMes = async (mes) => (await t.api.get(`/farmacias/guardias?mes=${mes}`)).body.dias;
const nombres = (turnos) => turnos.map((x) => x.nombre);

// ---------------------------------------------------------------- permisos

test('el directorio y las guardias se leen sin cuenta', async () => {
  for (const ruta of ['/farmacias', '/farmacias/guardia', '/farmacias/guardias']) {
    assert.equal((await t.api.get(ruta)).status, 200, ruta);
  }
});

test('solo un admin crea, edita, borra o carga calendarios', async () => {
  const intentos = [
    () => t.api.post('/farmacias', { nombre: 'X' }, { token: vecino.token }),
    () => t.api.patch('/farmacias/000000000000000000000001', { nombre: 'X' }, { token: vecino.token }),
    () => t.api.delete('/farmacias/000000000000000000000001', { token: vecino.token }),
    () => t.api.get('/farmacias/todas', { token: vecino.token }),
    () => t.api.put('/farmacias/guardias/2026-10', { guardias: [] }, { token: vecino.token }),
    () => t.api.delete('/farmacias/guardias/2026-10', { token: vecino.token }),
  ];
  for (const intento of intentos) assert.equal((await intento()).status, 403);

  assert.equal((await t.api.post('/farmacias', { nombre: 'X' })).status, 401);
});

// ------------------------------------------------------- sin calendario aún

test('sin ningún calendario cargado, no se inventa una guardia y se dice que no hay datos', async () => {
  const r = await t.api.get('/farmacias/guardia');
  assert.deepEqual(r.body.en_curso, []);
  assert.deepEqual(r.body.hoy.turnos, []);
  assert.deepEqual(r.body.manana.turnos, []);
  assert.equal(r.body.calendario_hasta, null);
});

// ---------------------------------------------------------------- directorio

test('crear una farmacia con ubicación la devuelve como lat/lng', async () => {
  const r = await crear({
    nombre: 'Farmacia Pérez',
    zona: 'lepe',
    direccion: 'Calle Real, 1',
    telefono: '959 00 00 01',
    ubicacion: { lat: 37.2541, lng: -7.2037 },
  });
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.farmacia.ubicacion, { lat: 37.2541, lng: -7.2037 });
  farmacia.perez = r.body.farmacia;

  farmacia.antilla = (await crear({ nombre: 'Farmacia La Antilla', zona: 'la_antilla' })).body.farmacia;
  farmacia.islantilla = (await crear({ nombre: 'Farmacia Islantilla', zona: 'islantilla' })).body.farmacia;
  farmacia.vacas = (await crear({ nombre: 'Farmacia Vacas Barranco', horario: '24 horas' })).body.farmacia;
});

test('una zona fuera de la lista o una farmacia sin nombre se rechazan', async () => {
  assert.equal((await crear({ nombre: 'Rara', zona: 'marte' })).status, 400);
  assert.equal((await crear({ zona: 'lepe' })).status, 400);
});

test('no se pueden colar campos que no están en la lista', async () => {
  const r = await crear({ nombre: 'Con extras', _id: '000000000000000000000001' });
  assert.equal(r.status, 201);
  assert.notEqual(r.body.farmacia._id, '000000000000000000000001');
  await t.api.delete(`/farmacias/${r.body.farmacia._id}`, { token: admin.token });
});

// ----------------------------------------------------------------- calendario

test('cargar un mes por nombre (sin tildes ni mayúsculas), con horarios, y leerlo', async () => {
  const r = await guardarMes('2026-10', [
    { dia: '2026-10-01', farmacia: 'farmacia perez', desde: '09:30', hasta: '22:00' },
    { dia: '2026-10-01', farmacia: 'FARMACIA   VACAS BARRANCO', desde: '00:00', hasta: '24:00' },
    { dia: '2026-10-02', farmacia: farmacia.perez._id, nota: 'Refuerzo' },
  ]);
  assert.equal(r.status, 200);
  assert.equal(r.body.guardias, 3);

  const dias = await delMes('2026-10');
  assert.deepEqual(dias.map((d) => d.dia), ['2026-10-01', '2026-10-02']);

  const primero = dias[0].turnos;
  assert.equal(primero.length, 2, 'dos farmacias el mismo día');
  assert.deepEqual(primero.map((x) => [x.nombre, x.desde, x.hasta]), [
    ['Farmacia Vacas Barranco', '00:00', '24:00'], // por hora de inicio: la de 24 h primero
    ['Farmacia Pérez', '09:30', '22:00'],
  ]);

  // Sin horario, el turno vale todo el día.
  assert.deepEqual([dias[1].turnos[0].desde, dias[1].turnos[0].hasta], ['00:00', '24:00']);
});

test('los nombres del cuadro del Colegio (con título, nombre de pila y dirección) se entienden', async () => {
  const sanchezMartin = (await crear({ nombre: 'Farmacia Sánchez Martín' })).body.farmacia;
  await crear({ nombre: 'Farmacia Sánchez Sánchez' });
  await crear({ nombre: 'Farmacia Prieto Martín y Morán Moliz' });

  const r = await guardarMes('2026-09', [
    { dia: '2026-09-01', farmacia: 'Farmacia Lda. Mª Esperanza Sanchez Martín (C/ Alcalde César Barrios, 2)' },
    { dia: '2026-09-01', farmacia: 'Farmacia Ldo. José Prieto Martín y Lda. Mª Teresa Morán Moliz (Plaza España, 1)' },
  ]);
  assert.equal(r.status, 200, JSON.stringify(r.body));

  const turnos = (await delMes('2026-09'))[0].turnos;
  assert.ok(turnos.some((x) => x._id === sanchezMartin._id), 'Sánchez Martín, no Sánchez Sánchez');
  assert.ok(turnos.some((x) => x.nombre === 'Farmacia Prieto Martín y Morán Moliz'));
  assert.equal(turnos.length, 2);
});

test('un nombre que encaja con dos farmacias se rechaza en vez de adivinar', async () => {
  const r = await guardarMes('2026-09', [{ dia: '2026-09-05', farmacia: 'Farmacia Sánchez' }]);
  assert.equal(r.status, 400);
  assert.match(r.body.mensaje, /ambiguas|no existen/);
});

test('un horario mal escrito se rechaza', async () => {
  const r = await guardarMes('2026-10', [{ dia: '2026-10-05', farmacia: 'Farmacia Pérez', desde: '25:00', hasta: '22:00' }]);
  assert.equal(r.status, 400);
  assert.match(r.body.mensaje, /Horarios no válidos/);
});

test('cargar el mismo mes otra vez lo sustituye entero', async () => {
  await guardarMes('2026-10', [{ dia: '2026-10-15', farmacia: 'Farmacia Islantilla' }]);
  assert.deepEqual((await delMes('2026-10')).map((d) => d.dia), ['2026-10-15']);
});

test('una entrada repetida no duplica la guardia', async () => {
  const r = await guardarMes('2026-11', [
    { dia: '2026-11-03', farmacia: 'Farmacia Pérez' },
    { dia: '2026-11-03', farmacia: 'farmacia perez' },
  ]);
  assert.equal(r.body.guardias, 1);
});

test('un calendario con errores se rechaza ENTERO y el mes anterior sigue intacto', async () => {
  const antes = await delMes('2026-10');

  const r = await guardarMes('2026-10', [
    { dia: '2026-10-05', farmacia: 'Farmacia Pérez' },
    { dia: '2026-10-06', farmacia: 'Farmacia que no existe' },
    { dia: '2026-10-32', farmacia: 'Farmacia Pérez' },
    { dia: '2026-09-30', farmacia: 'Farmacia Pérez' },
  ]);
  assert.equal(r.status, 400);
  assert.match(r.body.mensaje, /no existen/);
  assert.match(r.body.mensaje, /no válidas/);
  assert.match(r.body.mensaje, /no son de 2026-10/);

  assert.deepEqual(await delMes('2026-10'), antes);
});

test('un mes mal formado, vacío o una lista que no es lista se rechazan', async () => {
  assert.equal((await guardarMes('octubre', [{ dia: '2026-10-01', farmacia: 'Farmacia Pérez' }])).status, 400);
  assert.equal((await guardarMes('2026-13', [{ dia: '2026-13-01', farmacia: 'Farmacia Pérez' }])).status, 400);
  assert.equal((await guardarMes('2026-10', [])).status, 400);
  assert.equal((await t.api.put('/farmacias/guardias/2026-10', { guardias: 'hola' }, { token: admin.token })).status, 400);
});

test('vaciar un mes borra solo ese mes', async () => {
  await guardarMes('2026-12', [{ dia: '2026-12-24', farmacia: 'Farmacia Pérez' }]);
  const r = await t.api.delete('/farmacias/guardias/2026-12', { token: admin.token });
  assert.equal(r.body.eliminadas, 1);
  assert.equal((await delMes('2026-12')).length, 0);
  assert.equal((await delMes('2026-11')).length, 1, 'noviembre no se toca');
});

// ----------------------------------------------------------- guardia en curso

test('"ahora" son solo las guardias con el horario abierto: las ya cerradas o por abrir no cuentan', async () => {
  const ahora = ahoraEnMadrid();
  const manana = sumarDias(ahora.dia, 1);

  // Una ventana que NUNCA contiene la hora actual: por abrir si es por la
  // mañana, ya cerrada si es por la tarde.
  const [desde, hasta] = ahora.hora < '12:00' ? ['13:00', '14:00'] : ['01:00', '02:00'];

  const entradas = [
    { dia: ahora.dia, farmacia: 'Farmacia Vacas Barranco', desde: '00:00', hasta: '24:00' },
    { dia: ahora.dia, farmacia: 'Farmacia Pérez', desde, hasta },
    { dia: manana, farmacia: 'Farmacia La Antilla', desde: '09:30', hasta: '22:00' },
  ];
  // Hoy y mañana pueden ser de meses distintos (a fin de mes): cada mes se carga aparte.
  for (const mes of new Set(entradas.map((e) => e.dia.slice(0, 7)))) {
    const lasSuyas = entradas.filter((e) => e.dia.startsWith(mes));
    assert.equal((await guardarMes(mes, lasSuyas)).status, 200);
  }

  const r = await t.api.get('/farmacias/guardia');
  assert.deepEqual(nombres(r.body.en_curso), ['Farmacia Vacas Barranco']);
  // Por hora de inicio: la de 24 horas (00:00) siempre va antes que la de 01:00 o 13:00.
  assert.deepEqual(nombres(r.body.hoy.turnos), ['Farmacia Vacas Barranco', 'Farmacia Pérez']);
  assert.equal(r.body.hoy.dia, ahora.dia);
  assert.deepEqual(nombres(r.body.manana.turnos), ['Farmacia La Antilla']);
  assert.equal(r.body.manana.dia, manana);
});

test('de guardia ahora incluye los datos para llamar y llegar', async () => {
  const r = await t.api.get('/farmacias/guardia');
  const vacas = r.body.en_curso[0];
  assert.equal(vacas.nombre, 'Farmacia Vacas Barranco');
  assert.equal(vacas.horario, '24 horas');
});

// ------------------------------------------------------ desactivar y eliminar

test('una farmacia con guardias no se puede eliminar, pero sí desactivar', async () => {
  const borrar = await t.api.delete(`/farmacias/${farmacia.perez._id}`, { token: admin.token });
  assert.equal(borrar.status, 409);

  const desactivar = await t.api.patch(`/farmacias/${farmacia.perez._id}`, { activa: false }, { token: admin.token });
  assert.equal(desactivar.body.farmacia.activa, false);

  const publico = nombres((await t.api.get('/farmacias')).body.farmacias);
  assert.equal(publico.includes('Farmacia Pérez'), false, 'el directorio público la oculta');

  const todas = nombres((await t.api.get('/farmacias/todas', { token: admin.token })).body.farmacias);
  assert.equal(todas.includes('Farmacia Pérez'), true, 'el admin sí la ve, para reactivarla');

  const guardia = await t.api.get('/farmacias/guardia');
  assert.equal(nombres(guardia.body.hoy.turnos).includes('Farmacia Pérez'), true, 'el calendario manda: sigue en su día');
});

test('una farmacia sin guardias sí se elimina', async () => {
  const nueva = (await crear({ nombre: 'Efímera' })).body.farmacia;
  assert.equal((await t.api.delete(`/farmacias/${nueva._id}`, { token: admin.token })).status, 200);
  assert.equal((await t.api.delete(`/farmacias/${nueva._id}`, { token: admin.token })).status, 404);
});
