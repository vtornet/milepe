// Amplia la ficha de Contactos de interes con el directorio de Lepe.
// Fuentes, en orden de prioridad (si dos dan el mismo telefono gana la
// primera y la repetida se descarta, y se imprime cual):
//   1. Agencia Tributaria y canal de WhatsApp (datos dados a mano).
//   2. ayuntamiento.lepe.es/es/centros-municipales (oficial).
//   3. oralepe.org/contacto-2 (oficial de la concesionaria).
//   4. lepeymuchomas.blogspot.com, "Telefonos de interes" (NO oficial).
//
// Regla heredada de sembrar-contactos.mjs: un telefono de emergencias
// equivocado es peor que ninguno. Lo que sale solo del blog y es de
// emergencias, sanidad o proteccion (o tiene pinta de error) se siembra con
// activo: false y se lista al final para que alguien lo verifique.
//
// Idempotente: upsert por nombre con $setOnInsert, asi que no duplica ni
// pisa ediciones de un admin. Unica excepcion deliberada: un contacto
// oficial que siga con el telefono placeholder (Ayuntamiento, Policia
// Local, Proteccion Civil) se rellena, porque ahi no hay nada que pisar.
//
// Uso: node scripts/sembrar-directorio-lepe.mjs
import 'dotenv/config';
import mongoose from 'mongoose';
import conectarDB from '../src/config/db.js';
import ContactoInteres from '../src/models/ContactoInteres.js';

const PLACEHOLDER = '000000000';

const digitos = (t) => t.replace(/\D/g, '');
// 9 digitos -> "959 625 000"; 3 (112, 091...) y los demas, tal cual.
const formatear = (t) => {
  const d = digitos(t);
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d;
};

// [nombre, categoria, telefono, extras]. extras: direccion, email, notas,
// whatsapp, alt (telefono_alternativo), activo (false = pendiente de verificar).
const MANUALES_Y_OFICIALES = [
  ['Agencia Tributaria', 'administracion', '959382574', { direccion: 'Núcleo Residencial San Juan, 5 - Lepe', email: 'lepe@apthuelva.es' }],
  ['Ayuntamiento - Cita previa por WhatsApp', 'ayuntamiento', '644743207', { whatsapp: '644743207', notas: 'Canal automatizado de cita previa para trámites presenciales: Gestión Directa al Ciudadano, Urbanismo, Desarrollo Local, Servicios Sociales y Gestión Tributaria.' }],

  ['Ayuntamiento de Lepe', 'ayuntamiento', '959625000', { direccion: 'Plaza de España, 1' }],
  ['Policía Local de Lepe', 'policia_local', '959380092', { direccion: 'Edificio Multifuncional de Seguridad y Emergencias. Avda. Blas Infante, 37' }],
  ['Protección Civil de Lepe', 'proteccion_civil', '959625000', { direccion: 'Edificio Multifuncional de Seguridad y Emergencias. Avda. Blas Infante, 37', notas: 'Servicio Municipal de Emergencias y Protección Civil.' }],
  ['Archivo Municipal', 'ayuntamiento', '959625013', { direccion: 'Plaza de España, 1' }],
  ['Agricultura y Pesca, Medio Ambiente y Mantenimiento', 'ayuntamiento', '959645030', { direccion: 'C/ Aracena, 7 y s/n' }],
  ['Empleo y Desarrollo Local', 'ayuntamiento', '959625002', { direccion: 'C/ Oria Castañeda, Pasaje de la Casa Grande, s/n', alt: '959383973' }],
  ['Hacienda Local y Gestión Tributaria', 'ayuntamiento', '959625015', { direccion: 'C/ Iglesia, s/n. Edificio Juan de Lepe', notas: 'Gestión, recaudación e inspección tributaria.' }],
  ['Urbanismo, Obras Públicas', 'ayuntamiento', '959625005', { direccion: 'C/ Iglesia, 1. Edificio Municipal Juan de Lepe' }],
  ['Servicio de Juventud', 'ayuntamiento', '959625149', { direccion: 'Avda. La Arboleda, s/n' }],
  ['OMIC - Información al Consumidor', 'asociaciones', '607550533', { direccion: 'Ayuntamiento de Lepe. Plaza de España, 1' }],
  ['Servicios Sociales Comunitarios', 'ayuntamiento', '959645280', { direccion: 'Avda. La Arboleda, 7' }],
  ['Centro Municipal de Mayores "La Lonja"', 'ayuntamiento', '647706947', { direccion: 'Avda. de Huelva, s/n', notas: 'Centro Municipal de Mayores Santa María de la Bella.' }],
  ['Centro Ocupacional para la Inserción (COI)', 'ayuntamiento', '959645039', { direccion: 'Pol. Ind. Huerta Márquez, C/ Cañada del Pilar, 13' }],
  ['Almacenes Municipales', 'ayuntamiento', '959382531', { direccion: 'Pol. Ind. "El Chorrillo", C/ Talabarteros, s/n' }],
  ['Centro de Salud de Lepe', 'centro_salud', '959489835', { direccion: 'El Rompido, s/n' }],
  ['O.R.A. y grúa municipal', 'transporte', '667669153', { direccion: 'Avda. Blas Infante, 37, 1ª planta (jefatura de Policía Local)', email: 'info@oralepe.org', notas: 'Operada por EYSA. Depósito de grúa en el Pol. El Chorrillo, nave 15.' }],
  ['Biblioteca Municipal "Baltasar de los Ríos"', 'cultura_deporte', '959625033', { direccion: 'C/ Oria Castañeda, 36. Edif. Ajimez' }],
  ['Biblioteca Municipal de La Antilla', 'cultura_deporte', '607559806', { direccion: 'C/ Céfiro, s/n. La Antilla' }],
  ['Campo Municipal de Deportes', 'cultura_deporte', '959384509', { direccion: 'C/ Sevilla, s/n' }],
  ['Casa del Deporte y Pabellón "José Manuel Cortés Medina"', 'cultura_deporte', '959382002', { direccion: 'C/ Isla Canela, s/n' }],
  ['Centro Cultural Los Álamos', 'cultura_deporte', '959481479', { direccion: 'Avda. Castilla, s/n' }],
  ['Centro Municipal de Medicina Deportiva', 'cultura_deporte', '959382201', { direccion: 'Complejo Deportivo Las Moreras. C/ Isla Canela, s/n' }],
  ['Capilla de San Cristóbal (centro turístico y cultural)', 'cultura_deporte', '915871337', { direccion: 'C/ San Cristóbal, 4', activo: false, notas: 'PENDIENTE: el prefijo 915 es de Madrid; comprobar el número.' }],
  ['Teatro Municipal "Juan Manuel Santana" y Festejos', 'cultura_deporte', '959645149', { direccion: 'Avda. La Arboleda, s/n' }],
  ['FACUA Huelva', 'asociaciones', '959254911', { direccion: 'C/ Duque de Ahumada, 12 D. Huelva' }],
  ['UCA - Unión de Consumidores de Andalucía', 'asociaciones', '959730441', { direccion: 'C/ Berdigón, 3 Bajo A. Huelva' }],
];

// Del blog. NO oficial: lo de emergencias/sanidad va inactivo.
const PEND = { activo: false, notas: 'PENDIENTE de verificar: número tomado de un blog no oficial.' };
const BLOG = [
  // Educacion
  ['Escuela Infantil La Antilla', 'educacion', '959383060'],
  ['Guardería Nemo', 'educacion', '959625010'],
  ['Guardería El Barquito Azul', 'educacion', '959381027'],
  ['Guardería La Arboleda', 'educacion', '959380543'],
  ['Escuela Infantil Virgen de la Bella', 'educacion', '959380434'],
  ['Guardería Infantil Andalucía', 'educacion', '959383251'],
  ['Guardería Infantil Arco Iris', 'educacion', '959384275'],
  ['Guardería Colorín', 'educacion', '959383398'],
  ['Guardería Eduk', 'educacion', '959382648'],
  ['Instituto La Arboleda', 'educacion', '959382075'],
  ['CEIP Rodrigo Pérez Acevedo', 'educacion', '959489955'],
  ['Centro privado de Educación Infantil Eduk', 'educacion', '959393339'],
  ['Centro privado de Educación Infantil Arco Iris', 'educacion', '959383325'],
  ['Academia Progresa Lepe', 'educacion', '722374428'],
  ['Centro Público de Educación de Adultos', 'educacion', '959489548'],
  // Ayuntamiento / transporte
  ['Alcaldía de Lepe', 'ayuntamiento', '959625029'],
  ['Taxi Lepe', 'transporte', '959646257'],
  ['Estación de autobuses de Lepe', 'transporte', '959384677'],
  // Religioso
  ['Parroquia Santo Domingo de Guzmán', 'religioso', '959380240'],
  ['Parroquia Nuestra Señora del Carmen (La Antilla)', 'religioso', '629300195'],
  ['Capilla de los Pescadores (La Antilla)', 'religioso', '959480154'],
  ['Capilla de las Monjas', 'religioso', '635622257'],
  ['Capilla Cristo del Mar', 'religioso', '959384327'],
  // Salud: farmacias activas; el resto pendiente
  ['Farmacia Delgado Ajuria', 'centro_salud', '959380193'],
  ['Farmacia Gómez García', 'centro_salud', '959380101'],
  ['Farmacia Ramírez Gaya (La Antilla)', 'centro_salud', '959480148'],
  ['Farmacia Haro Urquízar', 'centro_salud', '959380071'],
  ['Centro de Salud de La Antilla', 'centro_salud', '959489620', PEND],
  ['Hospital Virgen de la Bella', 'centro_salud', '959180550', PEND],
  ['Cruz Roja Lepe', 'centro_salud', '959542219', { ...PEND, alt: '959625218' }],
  ['Emergencias sanitarias (línea local)', 'emergencias', '959527174', PEND],
  // Cultura y deporte
  ['Centro de Día', 'cultura_deporte', '959383162'],
  ['Peña Flamenca de Lepe', 'cultura_deporte', '959504059'],
  ['Palacio de Congresos de Islantilla', 'cultura_deporte', '959381651'],
  ['Pabellón Cubierto de Deportes', 'cultura_deporte', '959381320'],
  ['Escuela Hípica de Lepe', 'cultura_deporte', '959255154'],
  ['Escuela Hípica Municipal', 'cultura_deporte', '959480019'],
  ['Piscina Municipal', 'cultura_deporte', '959383404'],
  ['Club de Golf', 'cultura_deporte', '959625002'],
  // Asociaciones
  ['ASPLANDE Lepe', 'asociaciones', '959383384'],
  ['Huelva Acoge', 'asociaciones', '959489904'],
  ['Grupo Pandora', 'asociaciones', '959383359'],
  ['Asociación de Armadores de Lepe', 'asociaciones', '959380125'],
  ['Servicio Tutelada', 'asociaciones', '959383136'],
  ['Centro de Información a la Mujer', 'asociaciones', '959625034'],
  ['AA.VV. Las Moreras', 'asociaciones', '959481564'],
  ['AA.VV. Blas Infante', 'asociaciones', '959645001'],
  ['AA.VV. Don Ramiro', 'asociaciones', '959645255'],
  ['AA.VV. Barriada de Pescadores', 'asociaciones', '959645256'],
  ['AA.VV. Virgen de la Bella', 'asociaciones', '959625033'],
  ['Asociación Las Colonias', 'asociaciones', '959645038'],
  // Seguridad
  ['Policía Nacional', 'emergencias', '091'],
  ['Bomberos', 'bomberos', '080', PEND],
  // Otros de Lepe
  ['Centro Ocupacional de Islantilla', 'administracion', '959486039'],
  ['CEFO Islantilla', 'educacion', '959645200'],
  ['Oficina de Empleo SEPE Lepe', 'administracion', '959750598'],
  ['Instituto Social de la Marina', 'administracion', '959489709'],
  // Fuera de Lepe (Junta de Andalucia y otros)
  ['Consumo Responde', 'administracion', '900215080'],
  ['Atención a personas mayores', 'administracion', '900858381'],
  ['Información administrativa al ciudadano', 'administracion', '902505505'],
  ['Información a la Mujer 24 h', 'administracion', '900200999'],
  ['Información sobre drogodependencia', 'administracion', '900845040'],
  ['Información general a jóvenes', 'administracion', '901400040'],
  ['Información sobre dependencia', 'administracion', '902166170'],
  ['Información sobre el tabaco', 'administracion', '900850300'],
  ['Accesibilidad - atención a la ciudadanía', 'administracion', '902455564'],
  ['Atención ciudadana de Medio Ambiente', 'administracion', '902484802'],
  ['Usuarios de la A-92', 'administracion', '902333092'],
  ['Teleasistencia', 'administracion', '900200165'],
  ['Información general sobre infancia', 'administracion', '902102227'],
  ['Teléfono único de emergencias de Andalucía', 'emergencias', '902505061', PEND],
  ['Salud Responde', 'centro_salud', '902505060', PEND],
  ['Notificación de situaciones de maltrato infantil', 'emergencias', '900851818', PEND],
  // Alojamiento
  ['Albergue Rural', 'alojamiento', '959504049'],
  ['Pensión El Patio', 'alojamiento', '656427549'],
  ['Hotel La Barca', 'alojamiento', '959391025'],
  ['Hotel La Noria', 'alojamiento', '959383193'],
  ['Hotel Rural Valsequillo', 'alojamiento', '959380591'],
  ['Islantilla Golf Resort', 'alojamiento', '959204500'],
  ['Antilla', 'alojamiento', '678436728'],
  ['Hostal Azul', 'alojamiento', '959480700'],
  ['Apartamentos Leo', 'alojamiento', '959477337'],
  ['Puerto Antilla Grand Hotel', 'alojamiento', '959625100'],
  ['Confortel Islantilla', 'alojamiento', '959486017'],
];

const sembrar = async () => {
  await conectarDB();

  // Numeros ya usados: los nacionales sembrados antes + lo que vayamos
  // metiendo. Solo se aplica a las filas del blog; los centros oficiales
  // pueden compartir centralita (Agricultura, Medio Ambiente...).
  const usados = new Set(['112', '062', '061']);
  for (const [, , tel, extras] of MANUALES_Y_OFICIALES) {
    usados.add(digitos(tel));
    if (extras.alt) usados.add(digitos(extras.alt));
  }

  const descartados = [];
  const filas = MANUALES_Y_OFICIALES.map((f) => f);
  for (const [nombre, categoria, tel, extras = {}] of BLOG) {
    const d = digitos(tel);
    const alt = extras.alt ? digitos(extras.alt) : null;
    if (usados.has(d)) {
      descartados.push(`${nombre} (${formatear(tel)})`);
      continue;
    }
    usados.add(d);
    if (alt) usados.add(alt);
    filas.push([nombre, categoria, tel, extras]);
  }

  // 112 se sembro como 'otro' (que el cliente pintaba como Emergencias).
  await ContactoInteres.updateOne({ nombre: 'Emergencias', categoria: 'otro' }, { $set: { categoria: 'emergencias' } });

  let nuevos = 0;
  let rellenados = 0;
  const pendientes = [];

  for (const [i, [nombre, categoria, tel, extras = {}]] of filas.entries()) {
    const doc = {
      nombre,
      categoria,
      telefono: formatear(tel),
      telefono_alternativo: extras.alt ? formatear(extras.alt) : null,
      whatsapp: extras.whatsapp ? formatear(extras.whatsapp) : null,
      email: extras.email || null,
      direccion: extras.direccion || null,
      notas: extras.notas || null,
      orden: 100 + i,
      activo: extras.activo !== false,
    };

    const r = await ContactoInteres.updateOne({ nombre }, { $setOnInsert: doc }, { upsert: true });
    if (r.upsertedCount) nuevos += 1;

    // Oficial que sigue con el placeholder: se rellena.
    if (doc.activo) {
      const q = await ContactoInteres.updateOne(
        { nombre, telefono: PLACEHOLDER },
        { $set: { telefono: doc.telefono, direccion: doc.direccion, notas: doc.notas, activo: true } },
      );
      rellenados += q.modifiedCount;
    } else {
      pendientes.push(nombre);
    }
  }

  console.log(`[seed] Directorio: ${nuevos} nuevo(s), ${rellenados} placeholder(s) rellenado(s), ${filas.length - nuevos - rellenados} ya estaban.`);
  console.log(`[seed] ${descartados.length} del blog descartados por teléfono repetido:`);
  for (const d of descartados) console.log(`    - ${d}`);
  if (pendientes.length) {
    console.log(`[seed] ${pendientes.length} INACTIVOS (pendientes de verificar, no se ven en la app):`);
    for (const p of pendientes) console.log(`    - ${p}`);
  }

  await mongoose.disconnect();
};

sembrar().catch(async (error) => {
  console.error('[seed] Error sembrando el directorio:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
