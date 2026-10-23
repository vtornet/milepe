// Siembra el directorio de Farmacias con las de Lepe y La Antilla.
//
// FUENTE: el directorio de https://www.farmacias.es/huelva/lepe (direcciones y
// coordenadas) y su pagina de guardias (telefonos), consultado el
// 2026-10-23. Es una sola fuente, comercial (Farmactitud S.L.), que no dice
// de donde saca los datos: los telefonos NO estan contrastados con otra
// fuente. Ni el directorio ni los telefonos son oficiales; el Colegio de
// Farmacéuticos de Huelva tiene su propio localizador.
//
// Los nombres son "Farmacia" + el titular, que es como las lista esa web.
// Si el cuadro mensual del Colegio las nombra de otra forma, se corrigen
// desde la zona de administracion de /farmacias (el cargador de calendarios
// avisa de cualquier nombre que no encuentre).
//
// Faltan las de Islantilla (no aparece ninguna) y el telefono de la de La
// Antilla (la web no lo muestra). No se inventan: se dejan vacios.
//
// Idempotente: se identifica cada farmacia por su nombre y no pisa lo que un
// admin haya editado despues ($setOnInsert).
//
// Uso: node scripts/sembrar-farmacias.mjs
import 'dotenv/config';
import mongoose from 'mongoose';
import conectarDB from '../src/config/db.js';
import Farmacia from '../src/models/Farmacia.js';
import { aPuntoGeoJSON } from '../src/utils/geo.js';

const FARMACIAS = [
  {
    nombre: 'Farmacia Manuel Haro Urquizar',
    direccion: 'Calle Alcalde César Barrios, 2',
    telefono: '959 38 01 01',
    ubicacion: { lat: 37.2573, lng: -7.2004 },
  },
  {
    nombre: 'Farmacia Tomás Tena',
    direccion: 'Calle Alcalde César Barrios, 114',
    telefono: '959 38 32 21',
    ubicacion: { lat: 37.2589, lng: -7.1999911 },
  },
  {
    nombre: 'Farmacia Dolores Moreno Graciano',
    direccion: 'Calle Galaroza, 3',
    telefono: '959 64 50 31',
    ubicacion: { lat: 37.2609, lng: -7.19927 },
  },
  {
    nombre: 'Farmacia Manuel Aponte Tobarra',
    direccion: 'Calle Pinta, 6',
    telefono: '959 38 00 71',
    ubicacion: { lat: 37.2567, lng: -7.20664 },
  },
  {
    // La web escribe "Delgaldo", que parece una errata de Delgado.
    nombre: 'Farmacia Juana María Delgado Becerril',
    direccion: 'Avenida Blas Infante, s/n',
    telefono: '959 38 04 84',
    ubicacion: { lat: 37.2509, lng: -7.20452 },
  },
  {
    nombre: 'Farmacia Ricardo Luis Muela Hervás',
    direccion: 'Calle Guzmán y Zúñiga, 19-21',
    telefono: '959 38 46 40',
    ubicacion: { lat: 37.2481, lng: -7.2035707 },
  },
  {
    nombre: 'Farmacia Carmen Ramírez Gaya',
    zona: 'la_antilla',
    direccion: 'Avenida Castilla, s/n',
    ubicacion: { lat: 37.2067, lng: -7.21255 },
  },
];

const sembrar = async () => {
  await conectarDB();

  let nuevas = 0;
  for (const { ubicacion, zona = 'lepe', ...resto } of FARMACIAS) {
    const doc = { ...resto, zona, ubicacion: aPuntoGeoJSON(ubicacion), activa: true };
    const r = await Farmacia.updateOne({ nombre: doc.nombre }, { $setOnInsert: doc }, { upsert: true });
    if (r.upsertedCount) nuevas += 1;
  }

  console.log(`[seed] Farmacias: ${nuevas} nueva(s), ${FARMACIAS.length - nuevas} ya existían.`);
  await mongoose.disconnect();
};

sembrar().catch(async (error) => {
  console.error('[seed] Error sembrando farmacias:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
