// Siembra el directorio de Farmacias de Lepe, La Antilla e Islantilla.
//
// FUENTE: el localizador oficial del Colegio de Farmacéuticos de Huelva
// (https://cofhuelva.org/localizador/buscador-de-farmacias, localidades 53
// Lepe, 50 La Antilla y 48 Islantilla), consultado el 2026-10-23. Nombre del
// titular, direccion, telefono y horario habitual son los que da el Colegio.
// El Colegio no da coordenadas: las de las farmacias que tienen punto vienen
// del directorio de farmacias.es (misma direccion y mismo telefono, asi que
// es la misma farmacia). Las que no lo tienen se quedan sin punto: el "Como
// llegar" busca por direccion.
//
// Las tres localidades son distintas para el Colegio y cada una tiene su
// propio cuadro de guardias.
//
// El Colegio solo muestra UN tramo de fechas por farmacia ("Del 01-10 al
// 31-03"); el horario del resto del ano no aparece, y asi se guarda.
//
// Una primera siembra se hizo con farmacias.es, que resulto estar
// desactualizada (titulares viejos, faltaban 3 farmacias). Esas siete se
// retiran aqui, y solo si no tienen guardias en el calendario.
//
// Idempotente: se identifica cada farmacia por su nombre y no pisa lo que un
// admin haya editado despues ($setOnInsert).
//
// Uso: node scripts/sembrar-farmacias.mjs
import 'dotenv/config';
import mongoose from 'mongoose';
import conectarDB from '../src/config/db.js';
import Farmacia from '../src/models/Farmacia.js';
import GuardiaFarmacia from '../src/models/GuardiaFarmacia.js';
import { aPuntoGeoJSON } from '../src/utils/geo.js';

const FARMACIAS = [
  // ---- Lepe (localidad 53) ----
  {
    nombre: 'Farmacia Prieto Martín y Morán Moliz',
    direccion: 'Plaza de España, 1',
    telefono: '959 38 01 93',
    horario: 'Del 1 oct al 31 mar: L-V 9:00-21:30, S 9:30-14:30',
  },
  {
    nombre: 'Farmacia Sánchez Martín',
    direccion: 'Calle Alcalde César Barrios, 2',
    telefono: '959 38 01 01',
    horario: 'Todo el año: L-D y festivos 8:00-22:00',
    ubicacion: { lat: 37.2573, lng: -7.2004 },
  },
  {
    nombre: 'Farmacia Delgado Becerril',
    direccion: 'Avenida Blas Infante, 6',
    telefono: '959 38 04 84',
    horario: 'Todo el año: L-V 9:00-21:30, S 9:30-14:30',
    ubicacion: { lat: 37.2509, lng: -7.20452 },
  },
  {
    nombre: 'Farmacia Fernández Mera',
    direccion: 'Calle Pinta, 6',
    telefono: '959 38 00 71',
    horario: 'Del 1 oct al 30 abr: L-V 9:00-21:00, S 9:30-14:30',
    ubicacion: { lat: 37.2567, lng: -7.20664 },
  },
  {
    nombre: 'Farmacia Tena Trincado',
    direccion: 'Calle Alcalde César Barrios, 114',
    telefono: '959 38 32 21',
    horario: 'Del 1 oct al 31 mar: L-V 9:00-21:30, S 9:30-14:30',
    ubicacion: { lat: 37.2589, lng: -7.1999911 },
  },
  {
    nombre: 'Farmacia Perales González',
    direccion: 'Calle Galaroza, 3',
    telefono: '959 64 50 31',
    horario: 'Todo el año: L-V 9:00-22:00, S 9:30-14:30',
    ubicacion: { lat: 37.2609, lng: -7.19927 },
  },
  {
    nombre: 'Farmacia Muela Hervás',
    direccion: 'Calle Guzmán y Zúñiga, 15',
    telefono: '959 38 46 40',
    horario: 'Todo el año: L-V 8:30-21:30, S 9:30-14:30',
    ubicacion: { lat: 37.2481, lng: -7.2035707 },
  },
  {
    nombre: 'Farmacia Vacas Barranco',
    direccion: 'Avenida Andalucía, 55',
    telefono: '959 38 34 31',
    horario: '24 horas, todos los días del año',
  },
  {
    nombre: 'Farmacia Saniger Bernal',
    direccion: 'Avenida Andalucía, 7',
    telefono: '959 38 02 75',
    horario: 'Todo el año: L-S 9:00-22:00',
  },

  // ---- La Antilla (localidad 50) ----
  {
    nombre: 'Farmacia Ramírez Gaya',
    zona: 'la_antilla',
    direccion: 'Avenida Castilla (La Antilla)',
    telefono: '959 48 01 48',
    horario: 'Del 16 sep al 14 jun: L-V 9:30-14:00 y 17:00-20:00, S 9:30-14:30, D y festivos 10:00-14:00',
    ubicacion: { lat: 37.2067, lng: -7.21255 },
  },
  {
    nombre: 'Farmacia Dupuy Arnau',
    zona: 'la_antilla',
    direccion: 'Avda. de La Antilla, esquina calle Flamenco',
    telefono: '959 48 10 38',
    horario: 'Todo el año: L-S 8:30-20:30, D 9:00-15:00, festivos 8:30-20:30',
  },

  // ---- Islantilla (localidad 48) ----
  {
    nombre: 'Farmacia Sánchez Sánchez',
    zona: 'islantilla',
    direccion: 'Avda. Islantilla, C.C. Islantilla',
    telefono: '959 48 65 73 / 959 40 01 26',
    horario: 'Del 1 sep al 15 may: L-S 9:00-20:30, D y festivos 9:00-15:00',
  },
];

// La primera siembra, hecha con farmacias.es (titulares desactualizados).
const PROVISIONALES = [
  'Farmacia Manuel Haro Urquizar',
  'Farmacia Tomás Tena',
  'Farmacia Dolores Moreno Graciano',
  'Farmacia Manuel Aponte Tobarra',
  'Farmacia Juana María Delgado Becerril',
  'Farmacia Ricardo Luis Muela Hervás',
  'Farmacia Carmen Ramírez Gaya',
];

const sembrar = async () => {
  await conectarDB();

  let retiradas = 0;
  for (const nombre of PROVISIONALES) {
    const vieja = await Farmacia.findOne({ nombre });
    if (!vieja) continue;
    if (await GuardiaFarmacia.exists({ farmacia_id: vieja._id })) {
      console.log(`[seed] OJO: "${nombre}" tiene guardias en el calendario; no se retira.`);
      continue;
    }
    await vieja.deleteOne();
    retiradas += 1;
  }

  let nuevas = 0;
  for (const { ubicacion, zona = 'lepe', ...resto } of FARMACIAS) {
    const doc = { ...resto, zona, ubicacion: ubicacion ? aPuntoGeoJSON(ubicacion) : null, activa: true };
    const r = await Farmacia.updateOne({ nombre: doc.nombre }, { $setOnInsert: doc }, { upsert: true });
    if (r.upsertedCount) nuevas += 1;
  }

  console.log(`[seed] Farmacias: ${nuevas} nueva(s), ${FARMACIAS.length - nuevas} ya existían; ${retiradas} provisional(es) retirada(s).`);
  await mongoose.disconnect();
};

sembrar().catch(async (error) => {
  console.error('[seed] Error sembrando farmacias:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
