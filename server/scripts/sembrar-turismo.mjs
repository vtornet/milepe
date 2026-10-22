// Siembra la informacion de Turismo (coleccion RecursoTuristico) con los
// recursos de https://turismo.lepe.es, repartidos en sus siete secciones.
// Los textos son resumenes propios, no copias de la web, y cada ficha
// guarda en `fuente` la pagina de origen. Coordenadas, direcciones y
// telefonos son los que da la ficha; lo que no daba se deja vacio. No se
// siembran imagenes: las de la web del Ayuntamiento no son nuestras; un
// admin puede subir las suyas desde la propia seccion.
//
// Tambien retira las 15 fichas que una version anterior sembro como Posts
// (tipo 'turismo' + TurismoDetalle), porque Turismo ya no es contenido de
// vecinos. Solo lo hace si TODOS los posts de turismo son de esta siembra
// (titulo conocido y sin comentarios); si hay alguno de un vecino, no
// toca nada y lo dice.
//
// Idempotente: se identifica cada ficha por (seccion, titulo) y no pisa
// ediciones posteriores de un admin.
//
// Uso: node scripts/sembrar-turismo.mjs
import 'dotenv/config';
import mongoose from 'mongoose';
import conectarDB from '../src/config/db.js';
import RecursoTuristico from '../src/models/RecursoTuristico.js';
import Reaccion from '../src/models/Reaccion.js';
import { aPuntoGeoJSON } from '../src/utils/geo.js';

const BASE = 'https://turismo.lepe.es/es';
const p = (lat, lng) => ({ lat, lng });

// [seccion, titulo, descripcion, { ubicacion, direccion, telefono, web, fuente }]
const FICHAS = [
  // ---- Sol y playa ----
  ['sol_y_playa', 'Playa de La Antilla', 'El núcleo turístico por excelencia de Lepe, a menos de 5 km del pueblo. Más de 3 km de arena fina y dorada, con más de 3.000 horas de sol al año y distintivos como Bandera Azul, Q de Calidad Turística y Ecoplayas. Conserva su ambiente familiar y el barrio de pescadores, con barcas y redes aún sobre la arena. Restaurantes, chiringuitos y servicios de playa a pie de arena.', { ubicacion: p(37.204838, -7.218199), fuente: 'poi/playa-la-antilla' }],
  ['sol_y_playa', 'Playa de Islantilla', 'Destino turístico joven en el extremo occidental de la costa, compartido con Isla Cristina. Unos 2 km de arena fina separada de las urbanizaciones por dunas naturales. En la zona hay campo de golf de 27 hoyos, hoteles, centros comerciales, palacio de congresos y un festival de cine al aire libre junto al mar.', { ubicacion: p(37.203835, -7.233349), fuente: 'poi/playa-islantilla' }],
  ['sol_y_playa', 'Playa de Santa Pura', 'Playa natural de unos 2.250 m entre el extremo este de La Antilla y Nueva Umbría. Arena fina y dorada, dunas que la separan de las marismas del río Piedras y parte dentro del paraje natural protegido. Tiene socorrismo, hamacas y sombrillas, escuela de deportes náuticos y chiringuito. Bandera Azul; cada vez más popular entre el público joven.', { ubicacion: p(37.206277, -7.185554), fuente: 'poi/playa-de-santa-pura' }],
  ['sol_y_playa', 'Playa de Nueva Umbría', 'Unos 15 km de arena fina dentro del paraje natural Marismas del Río Piedras y Flecha de Nueva Umbría. Casi sin intervención humana: aguas limpias, dunas con vegetación y ningún edificio. Un tramo es nudista, el primero de la provincia. Ha servido de escenario de rodajes y anuncios.', { ubicacion: p(37.206662, -7.168118), fuente: 'poi/playa-nueva-umbr' }],
  ['sol_y_playa', 'Paraje Natural Marismas del Río Piedras y Flecha de Nueva Umbría', 'Espacio protegido desde 1989 donde el mar y el río Piedras se encuentran cerca de El Terrón. Su flecha arenosa de unos 15 km es una singularidad geomorfológica única en España. Marismas, playas y dunas con abundante fauna y flora (camaleón, tomillo Thymus carnosus). Ideal para senderismo, pesca y observación de aves; se contempla desde el mirador natural de El Catalán o el sendero verde que une La Antilla y Nueva Umbría.', { ubicacion: p(37.216785, -7.177065), fuente: 'poi/paraje-natural-marismas-del-r-o-piedras-y-flecha-de-nueva-umbr' }],
  ['sol_y_playa', 'Puerto de El Terrón', 'Puerto pesquero y deportivo junto a la desembocadura del río Piedras, dentro del espacio natural protegido. Muy ligado a la pesca del langostino y a los preparativos de la expedición de Juan Díaz de Solís. Hoy ofrece instalaciones para deportes náuticos, pesca y paseos en lancha; los barcos grandes no entran por la barra de arena de la desembocadura.', { ubicacion: p(37.22509, -7.173674), fuente: 'poi/puerto-de-el-terr-n' }],
  ['sol_y_playa', 'Pinares costeros', 'Pinares de gran valor natural y paisajístico que rodean el litoral y dan cobijo a especies amenazadas como el camaleón. Cuentan con protección municipal y se usan sobre todo para el ocio. Estudios recientes indican que compartieron territorio con los neandertales.', { ubicacion: p(37.22028, -7.20796), fuente: 'poi/pinares-costeros' }],
  ['sol_y_playa', 'La Almadraba de Nueva Umbría', 'Instalaciones levantadas en 1929: la "chanca" o poblado temporal donde vivían las tripulaciones de la pesca del atún, con escuela, economato y bar, y hasta 800 personas. La almadraba se practicaba aquí desde el siglo XV; llegó a capturar unos 32.000 atunes al año, cayó tras los años 50 y se abandonó en 1963.', { ubicacion: p(37.211286, -7.119669), fuente: 'poi/la-almadraba' }],

  // ---- Turismo activo ----
  ['turismo_activo', 'Campo de Golf de Islantilla', 'Campo de 27 hoyos en tres recorridos, rodeado de vegetación y con vistas al mar. Inaugurado en 1992, está considerado uno de los mejores de Andalucía y ha acogido torneos como el Turespaña Masters y el AGP de España.', { ubicacion: p(37.214054, -7.228769), fuente: 'poi/campo-de-golf' }],
  ['turismo_activo', 'Escuela Hípica Antonio Real', 'Fundada en junio de 2021, da clases de doma clásica, vaquera y salto y enseña el manejo y cuidado del caballo. Sus instalaciones están entre pinares y marismas, a unos 100 m del paraje natural; desde allí organizan rutas a caballo por la playa de Nueva Umbría. También ofrecen intervención asistida con caballos, baños ecuestres y celebraciones.', { ubicacion: p(37.241537, -7.189136), direccion: 'Carretera del Corchuelo, s/n', telefono: '681 011 549', web: 'https://escuelahipicaantonioreal.com/', fuente: 'poi/escuela-h-pica-antonio-real' }],
  ['turismo_activo', 'Excursiones Marítimas El Terrón', 'Paseos en barco por el río Piedras, con explicaciones del patrón sobre la historia y tradiciones de la zona y precios especiales para niños. El recorrido deja ver las Marismas del Río Piedras, el Real de la Almadraba de Nueva Umbría, la Flecha de Nueva Umbría y El Rompido, con degustación de gambas de Huelva y vino del Condado al atardecer.', { ubicacion: p(37.224576, -7.174456), direccion: 'Puerto de El Terrón', telefono: '622 706 664', web: 'https://rutaenbarco.es/', fuente: 'poi/excursiones-mar-timas-el-terr-n' }],
  ['turismo_activo', 'Escuela Municipal de Hípica de Lepe', 'Escuela municipal de equitación, un deporte con beneficios para la salud física y mental.', { telefono: '959 480 019', fuente: 'poi/escuela-municipal-de-h-pica-de-lepe' }],
  ['turismo_activo', 'Waingunga', 'Empresa de turismo activo y actividades deportivas.', { fuente: 'poi/waingunga' }],

  // ---- Turismo cultural ----
  ['turismo_cultural', 'Romería de La Bella', 'Fiesta popular con más de cincuenta años, considerada la tercera más importante de la región. Se celebra el segundo fin de semana de mayo, con trajes romeros, cante y sevillanas, y reúne a más de cien mil personas en el recinto junto a El Terrón, entre las ruinas del antiguo convento franciscano. Nació en 1966 por iniciativa de jóvenes de Acción Católica y en mayo de 2026 fue declarada Fiesta de Interés Turístico de Andalucía.', { ubicacion: p(37.224579, -7.184709), fuente: 'poi/romer-de-la-bella' }],
  ['turismo_cultural', 'Semana Santa', 'Semana Santa consolidada, con seis cofradías que sacan en procesión distintos pasos de la Pasión y Muerte de Jesucristo.', { fuente: 'poi/semana-santa' }],
  ['turismo_cultural', 'Fiesta de San Juan', 'Celebración en la playa de La Antilla con hogueras encendidas toda la noche, sobre las que la gente salta pidiendo deseos.', { fuente: 'poi/fiesta-de-san-juan' }],
  ['turismo_cultural', 'Cruz Primera', 'Cruz situada en el antiguo camino de Lepe; es la más cercana al pueblo.', { fuente: 'poi/cruz-primera' }],
  ['turismo_cultural', 'Capilla de Las Monjas', 'Capilla en la calle Las Monjas, cerca del desaparecido convento de la Piedad.', { fuente: 'poi/capilla-de-las-monjas' }],
  ['turismo_cultural', 'Capilla del Carmen (Barriada de los Pescadores)', 'Humilde y coqueta capilla de sencilla planta a orillas del Atlántico, donde los vecinos veneran a la patrona de los marineros.', { fuente: 'poi/capilla-del-carmen-barriada-de-los-pescadores' }],
  ['turismo_cultural', 'Parroquia del Carmen', 'Edificio de construcción reciente, con tres naves abovedadas, consagrado a la patrona de los marineros.', { fuente: 'poi/parroquia-del-carmen' }],
  ['turismo_cultural', 'Monumento al agricultor', 'Obra de 2001 de los artistas locales Francisco Sánchez y José Manuel Martínez, junto al parque de la Estación. Homenajea la agricultura.', { fuente: 'poi/monumento-al-agricultor' }],
  ['turismo_cultural', 'Monumento al marinero', 'En la plaza de los Marineros, recuerda la pesca, uno de los oficios más típicos del pasado de Lepe.', { fuente: 'poi/monumento-al-marinero' }],
  ['turismo_cultural', 'Monumento al V Centenario del Descubrimiento de América', 'Conjunto escultórico de la artista lepera Francisca Abreu, en el parque homónimo, a la entrada norte de Lepe.', { fuente: 'poi/monumento-al-v-centenario-del-descubrimiento-de-am-rica' }],
  ['turismo_cultural', 'Monumento a Fray José', 'Inaugurado con motivo del 175.º aniversario de la llegada de la Virgen de la Bella, en la plaza Fuentevieja.', { fuente: 'poi/monumento-fray-jos' }],

  // ---- Gastronomía ----
  ['gastronomia', 'Zampuzo "El Rata"', 'Fundado en 1932, con tres generaciones de historia. Roque lo lleva con ayuda de su mujer, elabora el vino de la casa y sirve tapas y platos variados, además de mosto de la cosecha anterior y mosto nuevo, que se puede probar desde principios de diciembre.', { ubicacion: p(37.255619, -7.206236), direccion: 'C/ Isla Cristina, 34', fuente: 'poi/zampuzo-el-rata' }],
  ['gastronomia', 'Zampuzo "Romera"', 'Funcionó entre 1984 y 1997 con otro nombre y reabrió en 2012 con el apellido de Juan Romera. Es el más espacioso de los zampuzos de Lepe, con cocina y dos barbacoas; a diario lo frecuentan personas mayores y, de vez en cuando, grupos de jóvenes.', { ubicacion: p(37.255454, -7.205372), direccion: 'C/ Encarnación, 45', fuente: 'poi/zampuzo-romera' }],
  ['gastronomia', 'Café - terraza Veo Veo', 'Cafetería con terraza pensada para los más pequeños, con espacio para jugar y socializar.', { fuente: 'poi/caf-terraza-veo-veo' }],

  // ---- Alojamientos ----
  ['alojamientos', 'DoubleTree by Hilton Islantilla Beach Golf Resort', 'Hotel de 4 estrellas, complejo de ocio y descanso en Islantilla, junto al campo de golf.', { telefono: '959 204 500', fuente: 'poi/double-tree-hilton-islantilla-beach-golf-resort' }],
  ['alojamientos', 'Hotel Rural Valsequillo', 'Hotel rural de 3 estrellas abierto todo el año; se presenta como el único complejo de este tipo en la costa onubense.', { telefono: '959 380 591', fuente: 'poi/hotel-rural-valsequillo' }],
  ['alojamientos', 'Hotel Marlin Antilla Playa', 'Hotel de 2 estrellas recién reformado, en primera línea de la playa de La Antilla.', { fuente: 'poi/hotel-marlin-antilla-playa' }],
  ['alojamientos', 'Hotel Portugal', 'Hotel económico de 2 estrellas con habitaciones climatizadas, televisión plana, wifi y baño.', { fuente: 'poi/hotel-portugal' }],
  ['alojamientos', 'Pensión Antilla Riad', 'Alojamiento turístico moderno y original, con instalaciones y equipamiento completos.', { fuente: 'poi/pensi-n-antilla-riad' }],
  ['alojamientos', 'Pensión Sol y Mar', 'Pensión con atención personalizada y servicio cuidado.', { fuente: 'poi/pensi-n-sol-y-mar' }],
  ['alojamientos', 'Pensión El Álamo', 'Pensión de 1 estrella junto al mar, pensada para descansar.', { fuente: 'poi/pensi-n-el-lamo' }],
  ['alojamientos', 'Hostal Puerto Lepe', 'Casa de huéspedes confortable de 1 estrella que además cuenta con un mostrador turístico.', { fuente: 'poi/hostal-puerto-lepe' }],
  ['alojamientos', 'Alojamiento Rural Waingunga', 'Dos opciones: tipo albergue con literas o turismo rural con camas individuales o de matrimonio.', { fuente: 'poi/alojamiento-rural-waingunga' }],

  // ---- Servicios turísticos ----
  ['servicios_turisticos', 'CineVIP +', 'Multicine con varias salas.', { fuente: 'poi/cinevip' }],
  ['servicios_turisticos', 'Centro Comercial Marina Ocio', 'Centro de ocio con bolera, cines, bingo, atracciones infantiles y discoteca.', { fuente: 'poi/centro-comercial-marina-ocio' }],
  ['servicios_turisticos', 'Centro Comercial Varadero', 'Centro comercial de la zona costera.', { fuente: 'poi/centro-comercial-varadero' }],

  // ---- Rutas ----
  ['rutas', 'Ruta Parque de los Cabezos', 'Sendero circular de baja dificultad por una zona boscosa del litoral, con amplias vistas a las playas. Sale de Islantilla, atraviesa el parque y bordea el campo de golf antes de volver al paseo. 3,7 km totalmente asfaltados, unas 1 h 15 min, a pie o en bici (no apto para coches).', { ubicacion: p(37.209267, -7.227542), fuente: 'poi/ruta-parque-de-los-cabezos' }],
  ['rutas', 'Ruta de la Tavirona', 'Parte de la antigua estación de tren de Lepe y sigue el trazado del viejo ferrocarril hasta el Puente de la Tavirona, con vistas a las Marismas del Río Piedras y Flecha de Nueva Umbría. Forma parte de la Vía Verde Litoral. Tierra compactada, dificultad baja, con vallas, bancos y señalización: apta para caminar, ir en bici o hacer deporte.', { fuente: 'node/1172' }],
  ['rutas', 'Sendero Azul de La Antilla', 'Ruta compartida para ciclistas y peatones que recorre la playa de La Antilla por espacios públicos y zonas verdes. Algo más de 3 km desde el Centro Cultural de Islantilla (calle Garza) hasta enlazar con el sendero dunar del Paraje Natural de las Marismas de Nueva Umbría.', { ubicacion: p(37.209009, -7.205705), fuente: 'poi/sendero-azul' }],
  ['rutas', 'Sendero Costa Occidental de Huelva (PR-A 131)', 'Ruta circular por el litoral occidental de Huelva desde el Pinar de Isla Cristina, entre dunas, las zonas urbanas de Islantilla y La Antilla y la playa de Nueva Umbría. Tres tramos señalizados que se pueden hacer por separado: Ruta de los Cabezos, Ruta playa de Nueva Umbría y Ruta El Camaleón.', { ubicacion: p(37.21063, -7.2015), fuente: 'poi/sendero-costa-occidental-de-huelva-pr-131' }],
];

// Titulos de las 15 fichas que la version anterior sembro como Posts.
const TITULOS_ANTIGUOS = new Set([
  'Playa de La Antilla', 'Playa de Islantilla', 'Playa de Santa Pura', 'Playa de Nueva Umbría',
  'Paraje Natural Marismas del Río Piedras y Flecha de Nueva Umbría', 'Puerto de El Terrón',
  'Pinares costeros', 'La Almadraba de Nueva Umbría', 'Romería de La Bella', 'Ruta Parque de los Cabezos',
  'Ruta de la Tavirona', 'Sendero Azul de La Antilla', 'Sendero Costa Occidental de Huelva (PR-A 131)',
  'Zampuzo "El Rata"', 'Zampuzo "Romera"',
]);

const retirarPostsAntiguos = async (db) => {
  const posts = await db.collection('posts').find({ tipo: 'turismo' }).toArray();
  if (posts.length === 0) return 0;

  const ajenos = posts.filter((x) => !TITULOS_ANTIGUOS.has(x.titulo) || x.num_comentarios > 0);
  if (ajenos.length > 0) {
    console.log(`[seed] OJO: hay ${ajenos.length} post(s) de turismo que no son de la siembra antigua (o tienen comentarios); no se retira ninguno:`);
    for (const x of ajenos) console.log(`    - ${x.titulo}`);
    return 0;
  }

  const ids = posts.map((x) => x._id);
  await db.collection('turismodetalles').deleteMany({ post_id: { $in: ids } });
  await Reaccion.deleteMany({ post_id: { $in: ids } });
  await db.collection('posts').deleteMany({ _id: { $in: ids } });
  return ids.length;
};

const sembrar = async () => {
  await conectarDB();

  let nuevas = 0;

  for (const [i, [seccion, titulo, descripcion, extras = {}]] of FICHAS.entries()) {
    const doc = {
      seccion,
      titulo,
      descripcion,
      direccion: extras.direccion || null,
      telefono: extras.telefono || null,
      web: extras.web || null,
      fuente: extras.fuente ? `${BASE}/${extras.fuente}` : null,
      ubicacion: extras.ubicacion ? aPuntoGeoJSON(extras.ubicacion) : null,
      orden: i,
      activo: true,
    };

    const r = await RecursoTuristico.updateOne({ seccion, titulo }, { $setOnInsert: doc }, { upsert: true });
    if (r.upsertedCount) nuevas += 1;
  }

  const retirados = await retirarPostsAntiguos(mongoose.connection.db);

  console.log(`[seed] Turismo: ${nuevas} ficha(s) nueva(s), ${FICHAS.length - nuevas} ya existían.`);
  if (retirados) console.log(`[seed] Retirados ${retirados} posts de turismo de la siembra antigua.`);

  await mongoose.disconnect();
};

sembrar().catch(async (error) => {
  console.error('[seed] Error sembrando turismo:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
