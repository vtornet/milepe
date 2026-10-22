// Siembra la ficha de Contactos de interes con un punto de partida.
// Idempotente: se puede ejecutar las veces que haga falta, no duplica
// (hace upsert por nombre).
//
// Uso: node scripts/sembrar-contactos.mjs
//
// IMPORTANTE sobre los telefonos: solo se dan por buenos los numeros
// nacionales estandar de España (112, 062, 061), que son los mismos en
// todo el pais. Los numeros locales de Lepe (Ayuntamiento, Policia Local)
// NO se inventan aqui: se siembran con un placeholder y activo: false,
// para que no lleguen a verse en la app hasta que alguien los verifique y
// los active. Publicar un telefono de emergencias equivocado es peor que
// no publicar ninguno.
import 'dotenv/config';
import mongoose from 'mongoose';
import conectarDB from '../src/config/db.js';
import ContactoInteres from '../src/models/ContactoInteres.js';

const PLACEHOLDER = '000000000';

const CONTACTOS = [
  {
    nombre: 'Emergencias',
    categoria: 'emergencias',
    telefono: '112',
    horario: 'Atención 24 horas',
    orden: 0,
    activo: true,
  },
  {
    nombre: 'Guardia Civil',
    categoria: 'guardia_civil',
    telefono: '062',
    horario: 'Atención 24 horas',
    orden: 1,
    activo: true,
  },
  {
    nombre: 'Emergencias sanitarias',
    categoria: 'centro_salud',
    telefono: '061',
    horario: 'Atención 24 horas',
    orden: 2,
    activo: true,
  },
  {
    nombre: 'Ayuntamiento de Lepe',
    categoria: 'ayuntamiento',
    telefono: PLACEHOLDER,
    orden: 3,
    activo: false,
  },
  {
    nombre: 'Policía Local de Lepe',
    categoria: 'policia_local',
    telefono: PLACEHOLDER,
    orden: 4,
    activo: false,
  },
  {
    nombre: 'Protección Civil de Lepe',
    categoria: 'proteccion_civil',
    telefono: PLACEHOLDER,
    orden: 5,
    activo: false,
  },
];

const sembrar = async () => {
  await conectarDB();

  for (const contacto of CONTACTOS) {
    await ContactoInteres.updateOne({ nombre: contacto.nombre }, { $setOnInsert: contacto }, { upsert: true });
  }

  const pendientes = await ContactoInteres.find({ telefono: PLACEHOLDER }, 'nombre');

  console.log(`[seed] ${CONTACTOS.length} contacto(s) asegurados en la ficha.`);

  if (pendientes.length > 0) {
    console.log('');
    console.log('  AVISO: estos contactos estan INACTIVOS (no se ven en la app)');
    console.log('  porque su telefono es un placeholder sin verificar:');
    for (const p of pendientes) console.log(`    - ${p.nombre}`);
    console.log('');
    console.log('  Pon el telefono real y activo: true (PATCH /api/contactos-interes/:id,');
    console.log('  como admin) antes de que nadie dependa de ellos.');
  }

  await mongoose.disconnect();
};

sembrar().catch(async (error) => {
  console.error('[seed] Error sembrando contactos:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
