// Siembra la seccion de Turismo con los recursos de https://turismo.lepe.es
// (playas, rutas, gastronomia y puntos de interes). Los textos son
// resumenes propios, no copias de la web, y cada ficha lleva la URL de
// origen para quien quiera ampliar. Coordenadas tomadas del mapa de cada
// ficha. No se siembran imagenes: las de la web del Ayuntamiento no son
// nuestras; se pueden anadir despues subiendolas a Cloudinary.
//
// Idempotente: se identifica cada ficha por su titulo (tipo 'turismo'), asi
// que ejecutarlo de nuevo no duplica ni pisa ediciones posteriores.
//
// Uso: node scripts/sembrar-turismo.mjs
// Las fichas se publican a nombre de la primera cuenta admin (o, si no hay,
// moderador) porque Post exige autor.
import 'dotenv/config';
import mongoose from 'mongoose';
import conectarDB from '../src/config/db.js';
import Post from '../src/models/Post.js';
import TurismoDetalle from '../src/models/TurismoDetalle.js';
import Usuario from '../src/models/Usuario.js';
import { aPuntoGeoJSON } from '../src/utils/geo.js';

const BASE = 'https://turismo.lepe.es/es';

const FICHAS = [
  {
    titulo: 'Playa de La Antilla',
    categoria: 'playa',
    ubicacion: { lat: 37.204838, lng: -7.218199 },
    contenido:
      'El núcleo turístico por excelencia de Lepe, a menos de 5 km del pueblo. Más de 3 km de arena fina y dorada, con más de 3.000 horas de sol al año y distintivos como Bandera Azul, Q de Calidad Turística y Ecoplayas. Conserva su ambiente familiar y el barrio de pescadores, con barcas y redes aún sobre la arena. Restaurantes, chiringuitos y servicios de playa a pie de arena.',
    fuente: 'poi/playa-la-antilla',
  },
  {
    titulo: 'Playa de Islantilla',
    categoria: 'playa',
    ubicacion: { lat: 37.203835, lng: -7.233349 },
    contenido:
      'Destino turístico joven en el extremo occidental de la costa, compartido con Isla Cristina. Unos 2 km de arena fina separada de las urbanizaciones por dunas naturales. En la zona hay campo de golf de 27 hoyos, hoteles, centros comerciales, palacio de congresos y un festival de cine al aire libre junto al mar.',
    fuente: 'poi/playa-islantilla',
  },
  {
    titulo: 'Playa de Santa Pura',
    categoria: 'playa',
    ubicacion: { lat: 37.206277, lng: -7.185554 },
    contenido:
      'Playa natural de unos 2.250 m entre el extremo este de La Antilla y Nueva Umbría. Arena fina y dorada, dunas que la separan de las marismas del río Piedras y parte dentro del paraje natural protegido. Tiene socorrismo, hamacas y sombrillas, escuela de deportes náuticos y chiringuito. Bandera Azul; cada vez más popular entre el público joven.',
    fuente: 'poi/playa-de-santa-pura',
  },
  {
    titulo: 'Playa de Nueva Umbría',
    categoria: 'playa',
    ubicacion: { lat: 37.206662, lng: -7.168118 },
    contenido:
      'Unos 15 km de arena fina dentro del paraje natural Marismas del Río Piedras y Flecha de Nueva Umbría. Casi sin intervención humana: aguas limpias, dunas con vegetación y ningún edificio. Un tramo es nudista, el primero de la provincia. Ha servido de escenario de rodajes y anuncios.',
    fuente: 'poi/playa-nueva-umbr',
  },
  {
    titulo: 'Paraje Natural Marismas del Río Piedras y Flecha de Nueva Umbría',
    categoria: 'otro',
    ubicacion: { lat: 37.216785, lng: -7.177065 },
    contenido:
      'Espacio protegido desde 1989 donde el mar y el río Piedras se encuentran cerca de El Terrón. Su flecha arenosa de unos 15 km es una singularidad geomorfológica única en España. Marismas, playas y dunas con abundante fauna y flora (camaleón, tomillo Thymus carnosus). Ideal para senderismo, pesca y observación de aves; se contempla desde el mirador natural de El Catalán o el sendero verde que une La Antilla y Nueva Umbría.',
    fuente: 'poi/paraje-natural-marismas-del-r-o-piedras-y-flecha-de-nueva-umbr',
  },
  {
    titulo: 'Puerto de El Terrón',
    categoria: 'otro',
    ubicacion: { lat: 37.22509, lng: -7.173674 },
    contenido:
      'Puerto pesquero y deportivo junto a la desembocadura del río Piedras, dentro del espacio natural protegido. Muy ligado a la pesca del langostino y a los preparativos de la expedición de Juan Díaz de Solís. Hoy ofrece instalaciones para deportes náuticos, pesca y paseos en lancha; los barcos grandes no entran por la barra de arena de la desembocadura.',
    fuente: 'poi/puerto-de-el-terr-n',
  },
  {
    titulo: 'Pinares costeros',
    categoria: 'otro',
    ubicacion: { lat: 37.22028, lng: -7.20796 },
    contenido:
      'Pinares de gran valor natural y paisajístico que rodean el litoral y dan cobijo a especies amenazadas como el camaleón. Cuentan con protección municipal y se usan sobre todo para el ocio. Estudios recientes indican que compartieron territorio con los neandertales.',
    fuente: 'poi/pinares-costeros',
  },
  {
    titulo: 'La Almadraba de Nueva Umbría',
    categoria: 'otro',
    ubicacion: { lat: 37.211286, lng: -7.119669 },
    contenido:
      'Instalaciones levantadas en 1929: la "chanca" o poblado temporal donde vivían las tripulaciones de la pesca del atún, con escuela, economato y bar, y hasta 800 personas. La almadraba se practicaba aquí desde el siglo XV; llegó a capturar unos 32.000 atunes al año, cayó tras los años 50 y se abandonó en 1963.',
    fuente: 'poi/la-almadraba',
  },
  {
    titulo: 'Romería de La Bella',
    categoria: 'otro',
    ubicacion: { lat: 37.224579, lng: -7.184709 },
    contenido:
      'Fiesta popular con más de cincuenta años, considerada la tercera más importante de la región. Se celebra el segundo fin de semana de mayo, con trajes romeros, cante y sevillanas, y reúne a más de cien mil personas en el recinto junto a El Terrón, entre las ruinas del antiguo convento franciscano. Nació en 1966 por iniciativa de jóvenes de Acción Católica y en mayo de 2026 fue declarada Fiesta de Interés Turístico de Andalucía.',
    fuente: 'poi/romer-de-la-bella',
  },
  {
    titulo: 'Ruta Parque de los Cabezos',
    categoria: 'ruta',
    ubicacion: { lat: 37.209267, lng: -7.227542 },
    contenido:
      'Sendero circular de baja dificultad por una zona boscosa del litoral, con amplias vistas a las playas. Sale de Islantilla, atraviesa el parque y bordea el campo de golf antes de volver al paseo. 3,7 km totalmente asfaltados, unas 1 h 15 min, a pie o en bici (no apto para coches).',
    fuente: 'poi/ruta-parque-de-los-cabezos',
  },
  {
    titulo: 'Ruta de la Tavirona',
    categoria: 'ruta',
    // La ficha no trae coordenadas; sin ubicacion hasta que alguien la marque.
    contenido:
      'Parte de la antigua estación de tren de Lepe y sigue el trazado del viejo ferrocarril hasta el Puente de la Tavirona, con vistas a las Marismas del Río Piedras y Flecha de Nueva Umbría. Forma parte de la Vía Verde Litoral. Tierra compactada, dificultad baja, con vallas, bancos y señalización: apta para caminar, ir en bici o hacer deporte.',
    fuente: 'node/1172',
  },
  {
    titulo: 'Sendero Azul de La Antilla',
    categoria: 'ruta',
    ubicacion: { lat: 37.209009, lng: -7.205705 },
    contenido:
      'Ruta compartida para ciclistas y peatones que recorre la playa de La Antilla por espacios públicos y zonas verdes. Algo más de 3 km desde el Centro Cultural de Islantilla (calle Garza) hasta enlazar con el sendero dunar del Paraje Natural de las Marismas de Nueva Umbría.',
    fuente: 'poi/sendero-azul',
  },
  {
    titulo: 'Sendero Costa Occidental de Huelva (PR-A 131)',
    categoria: 'ruta',
    ubicacion: { lat: 37.21063, lng: -7.2015 },
    contenido:
      'Ruta circular por el litoral occidental de Huelva desde el Pinar de Isla Cristina, entre dunas, las zonas urbanas de Islantilla y La Antilla y la playa de Nueva Umbría. Tres tramos señalizados que se pueden hacer por separado: Ruta de los Cabezos, Ruta playa de Nueva Umbría y Ruta El Camaleón.',
    fuente: 'poi/sendero-costa-occidental-de-huelva-pr-131',
  },
  {
    titulo: 'Zampuzo "El Rata"',
    categoria: 'gastronomia',
    ubicacion: { lat: 37.255619, lng: -7.206236 },
    contenido:
      'Zampuzo fundado en 1932, con tres generaciones de historia, en la calle Isla Cristina, 34. Roque lo lleva con ayuda de su mujer, elabora el vino de la casa y sirve tapas y platos variados, además de mosto de la cosecha anterior y mosto nuevo, que se puede probar desde principios de diciembre.',
    fuente: 'poi/zampuzo-el-rata',
  },
  {
    titulo: 'Zampuzo "Romera"',
    categoria: 'gastronomia',
    ubicacion: { lat: 37.255454, lng: -7.205372 },
    contenido:
      'En la calle Encarnación, 45. Funcionó entre 1984 y 1997 con otro nombre y reabrió en 2012 con el apellido de Juan Romera. Es el más espacioso de los zampuzos de Lepe, con cocina y dos barbacoas; a diario lo frecuentan personas mayores y, de vez en cuando, grupos de jóvenes.',
    fuente: 'poi/zampuzo-romera',
  },
];

const sembrar = async () => {
  await conectarDB();

  const autor =
    (await Usuario.findOne({ rol: 'admin', activo: true }, '_id')) ||
    (await Usuario.findOne({ rol: 'moderador', activo: true }, '_id'));

  if (!autor) {
    throw new Error('No hay ninguna cuenta admin/moderador a la que atribuir las fichas.');
  }

  let creadas = 0;

  for (const ficha of FICHAS) {
    const existe = await Post.exists({ tipo: 'turismo', titulo: ficha.titulo });
    if (existe) continue;

    const post = await Post.create({
      autor_id: autor._id,
      tipo: 'turismo',
      titulo: ficha.titulo,
      contenido: `${ficha.contenido}\n\nMás información: ${BASE}/${ficha.fuente}`,
    });

    try {
      await TurismoDetalle.create({
        post_id: post._id,
        categoria: ficha.categoria,
        ubicacion: ficha.ubicacion ? aPuntoGeoJSON(ficha.ubicacion) : undefined,
      });
    } catch (error) {
      await Post.deleteOne({ _id: post._id });
      throw error;
    }

    creadas += 1;
  }

  console.log(`[seed] Turismo: ${creadas} ficha(s) nueva(s), ${FICHAS.length - creadas} ya existían.`);
  await mongoose.disconnect();
};

sembrar().catch(async (error) => {
  console.error('[seed] Error sembrando turismo:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
