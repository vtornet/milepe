import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar } from './ayuda.js';
import { ahoraEnMadrid, diaDeGuardia, sumarDias } from '../src/utils/guardiaFarmacia.js';

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
  assert.equal(r.body.actual.farmacias.length, 0);
  assert.equal(r.body.siguiente.farmacias.length, 0);
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

test('cargar un mes por nombre (sin tildes ni mayúsculas) y leerlo', async () => {
  const r = await guardarMes('2026-10', [
    { dia: '2026-10-01', farmacia: 'farmacia perez' },
    { dia: '2026-10-02', farmacia: 'FARMACIA   LA ANTILLA', nota: 'De 9:30 a 22:00' },
    { dia: '2026-10-02', farmacia: farmacia.perez._id },
  ]);
  assert.equal(r.status, 200);
  assert.equal(r.body.guardias, 3);

  const dias = await delMes('2026-10');
  assert.deepEqual(dias.map((d) => d.dia), ['2026-10-01', '2026-10-02']);
  assert.equal(dias[1].farmacias.length, 2, 'dos farmacias el mismo día');
  assert.ok(dias[1].farmacias.some((f) => f.nota === 'De 9:30 a 22:00'));
});

test('cargar el mismo mes otra vez lo sustituye entero', async () => {
  await guardarMes('2026-10', [{ dia: '2026-10-15', farmacia: 'Farmacia Islantilla' }]);
  const dias = await delMes('2026-10');
  assert.deepEqual(dias.map((d) => d.dia), ['2026-10-15']);
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

test('la guardia actual y la siguiente salen de los días que tocan según la hora', async () => {
  const dia = diaDeGuardia(ahoraEnMadrid());
  const siguiente = sumarDias(dia, 1);

  // Pueden caer en meses distintos (a fin de mes), y cada mes se carga aparte.
  await guardarMes(dia.slice(0, 7), [{ dia, farmacia: 'Farmacia Pérez', nota: 'Hoy' }]);
  await guardarMes(siguiente.slice(0, 7), [
    ...(siguiente.slice(0, 7) === dia.slice(0, 7) ? [{ dia, farmacia: 'Farmacia Pérez', nota: 'Hoy' }] : []),
    { dia: siguiente, farmacia: 'Farmacia La Antilla' },
  ]);

  const r = await t.api.get('/farmacias/guardia');
  assert.equal(r.body.actual.dia, dia);
  assert.deepEqual(r.body.actual.farmacias.map((f) => f.nombre), ['Farmacia Pérez']);
  assert.equal(r.body.actual.farmacias[0].telefono, '959 00 00 01');
  assert.equal(r.body.siguiente.dia, siguiente);
  assert.deepEqual(r.body.siguiente.farmacias.map((f) => f.nombre), ['Farmacia La Antilla']);
  // El último día con datos de todo lo cargado (noviembre ya lo estaba).
  assert.equal(r.body.calendario_hasta, [siguiente, '2026-11-03'].sort().at(-1));
  assert.equal(r.body.cambio, '09:30');
});

// ------------------------------------------------------ desactivar y eliminar

test('una farmacia con guardias no se puede eliminar, pero sí desactivar', async () => {
  const borrar = await t.api.delete(`/farmacias/${farmacia.perez._id}`, { token: admin.token });
  assert.equal(borrar.status, 409);

  const desactivar = await t.api.patch(`/farmacias/${farmacia.perez._id}`, { activa: false }, { token: admin.token });
  assert.equal(desactivar.body.farmacia.activa, false);

  const publico = (await t.api.get('/farmacias')).body.farmacias.map((f) => f.nombre);
  assert.equal(publico.includes('Farmacia Pérez'), false, 'el directorio público la oculta');

  const admin_ = (await t.api.get('/farmacias/todas', { token: admin.token })).body.farmacias.map((f) => f.nombre);
  assert.equal(admin_.includes('Farmacia Pérez'), true, 'el admin sí la ve, para reactivarla');

  const guardia = await t.api.get('/farmacias/guardia');
  assert.equal(guardia.body.actual.farmacias.length, 1, 'el calendario manda: sigue saliendo de guardia');
});

test('una farmacia sin guardias sí se elimina', async () => {
  const nueva = (await crear({ nombre: 'Efímera' })).body.farmacia;
  assert.equal((await t.api.delete(`/farmacias/${nueva._id}`, { token: admin.token })).status, 200);
  assert.equal((await t.api.delete(`/farmacias/${nueva._id}`, { token: admin.token })).status, 404);
});
