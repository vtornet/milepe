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
  // ---- Ampliación: páginas 2 y siguientes de turismo.lepe.es ----
  // Alojamientos. Las estrellas son la categoría que figura en el título de
  // cada ficha del Ayuntamiento.
  ['alojamientos', 'Puerto Antilla Grand Hotel', 'Hotel de cuatro estrellas en Islantilla con zonas de ocio y descanso: piscinas exteriores, piscina interior climatizada, zona de spa, gimnasio, pistas de pádel, sala de juegos y miniclub.', { ubicacion: p(37.206458, -7.230543), direccion: 'Avda. de Islantilla, s/n', telefono: '959 62 51 00', web: 'http://www.puertoantilla.com/', fuente: 'poi/puerto-antilla-grand-hotel' }],
  ['alojamientos', 'Hostal Azul', 'Hostal de dos estrellas en pleno centro de la playa de La Antilla, a pocos metros del paseo marítimo y de la zona de bares y restaurantes. La Antilla está a unos 6 km de Lepe y a unos 20 km de Portugal.', { ubicacion: p(37.205918, -7.21764), direccion: 'Avda. de La Antilla, 15', telefono: '959 48 07 00', web: 'http://www.hostalazul.com/', fuente: 'poi/hostal-azul' }],
  ['alojamientos', 'Pensión Playa', 'Pensión en La Antilla, a pocos metros de la playa y del paseo marítimo, junto a la avenida de Castilla y su zona de bares y restaurantes.', { ubicacion: p(37.206074, -7.217709), direccion: 'Avda. de La Antilla, 23', telefono: '959 48 07 26', fuente: 'poi/pensi-n-playa' }],
  ['alojamientos', 'AMA Andalucía', 'Alojamiento de cuatro estrellas dentro del campo de golf de Islantilla, a unos 5 minutos en coche de la playa. Habitaciones amplias, piscina interior y tres exteriores, y centro de bienestar con jacuzzi, baño de vapor y gimnasio. Da acceso al campo de golf de 27 hoyos.', { ubicacion: p(37.215261, -7.22601), direccion: 'Paseo de las Cumbres, s/n', telefono: '959 87 32 00', web: 'http://www.marblehotels.com/', fuente: 'poi/ama-andaluc' }],
  ['alojamientos', 'Pensión La Parada', 'Pensión de una estrella en La Antilla, muy cerca de la playa, con 14 habitaciones y 26 plazas.', { ubicacion: p(37.206175, -7.217708), direccion: 'Avda. de La Antilla, 21', telefono: '959 48 14 62', fuente: 'poi/pensi-n-la-parada' }],
  ['alojamientos', 'Hostal El Patio', 'Hostal de dos estrellas a unos 5 minutos a pie del centro de Lepe y de Marina Ocio, en la carretera principal hacia La Antilla (5 km). Recepción 24 horas, wifi gratuito y habitaciones con aire acondicionado, nevera, televisión y baño privado en torno a un patio con cubierta acristalada. Desayuno buffet diario, jacuzzi abierto las 24 horas y terraza chill out.', { ubicacion: p(37.24937, -7.202933), direccion: 'Calle Río Odiel, 1', telefono: '656 42 75 49', web: 'http://www.hostalelpatiodelepe.com/', fuente: 'poi/hostal-el-patio' }],
  ['alojamientos', 'Hotel La Barca', 'Hotel de dos estrellas en el valle de La Barca, junto al puente sobre el río Piedras, entre Lepe y Cartaya y al lado de las marismas protegidas y de la Vía Verde. Buen punto de partida para las playas de La Antilla, Islantilla y Nueva Umbría y para los campos de golf de la zona. Dispone de salones y restaurante para celebraciones y reuniones.', { ubicacion: p(37.283794, -7.178461), direccion: 'Ctra. N-431, km 113,5 (Finca Valle de La Barca)', telefono: '959 39 10 25', web: 'http://www.hotellabarca.es/', fuente: 'poi/hotel-la-barca' }],
  ['alojamientos', 'Camping La Antilla', 'Camping de dos estrellas de ambiente familiar y trato tranquilo y cercano, en las playas de Huelva, con instalaciones para toda la familia. Apuesta por la convivencia, el contacto con la naturaleza y la atención personalizada.', { ubicacion: p(37.215748, -7.193597), direccion: 'Carretera La Antilla-El Terrón, km 2', telefono: '959 48 08 29', web: 'http://www.campingantilla.com/', fuente: 'poi/camping-la-antilla' }],
  ['alojamientos', 'Ohtels Islantilla', 'Hotel de cuatro estrellas a unos 200 m de la playa de Islantilla. Tiene 346 habitaciones, 298 de ellas junior suites, zona de spa, piscinas interior y exterior y terrazas. Incluye un Palacio de Ferias y Congresos de más de 4.900 m² con salones, salas de exposiciones y auditorio.', { ubicacion: p(37.207877, -7.230964), direccion: 'Avda. de Río Frío, s/n', telefono: '959 48 65 08', web: 'http://www.ohtelsislantilla.es/', fuente: 'poi/ohtels-islantilla' }],

  // Turismo cultural: patrimonio, museos, plazas, monumentos y fiestas.
  ['turismo_cultural', 'Iglesia Santo Domingo de Guzmán', 'En la plaza de España, es el gran templo de Lepe. El origen es del siglo XVI, en estilo gótico-mudéjar, sobre un edificio probablemente del XIV; nació como iglesia conventual dominica y fue declarada monumento histórico-artístico en 1985. Tiene planta de tres naves y una torre de tres cuerpos; la portada de los pies mezcla elementos mudéjares y barrocos. La capilla sacramental custodia a la Virgen de La Bella, patrona de Lepe, procedente del convento franciscano de El Terrón. Guarda también una Inmaculada atribuida a Giuseppe Cesari, retablos de otros conventos desaparecidos y un rico ajuar litúrgico.', { ubicacion: p(37.254228, -7.203714), direccion: 'Calle Iglesia, 2', telefono: '959 38 02 40', fuente: 'poi/iglesia-santo-domingo-de-guzm-n' }],
  ['turismo_cultural', 'Capilla San Cristóbal', 'Edificio exento del siglo XVI en estilo mudéjar, de ladrillo y una sola nave, con presbiterio cubierto por una bóveda octogonal sobre trompas. Se alzaba en una antigua entrada del pueblo, en el cruce de caminos entre el marquesado de Ayamonte y Sevilla. Tras dejar el culto en el siglo XIX fue matadero público hasta los años 80. Una rehabilitación reciente recuperó parte de las pinturas murales: los cuatro evangelistas y figuras del Antiguo Testamento.', { ubicacion: p(37.254187, -7.205823), direccion: 'Calle San Cristóbal, 4', fuente: 'poi/capilla-san-crist-bal' }],
  ['turismo_cultural', 'Casa Museo Castillo de Lepe', 'Casa museo privada y gratuita creada por Manuel Santana Gómez, "Manolo Castillo", con una exposición permanente de enseres y costumbres populares de Lepe y un archivo de documentos históricos. Reúne una biblioteca de más de tres mil volúmenes, cientos de archivadores con documentos de hace dos siglos, más de 800.000 fotografías, juguetes artesanales de los años cincuenta y los archivos de La Voz de Lepe y del Club Deportivo San Roque. Horario: lunes a viernes de 9:30 a 13:00 y de 17:30 a 20:00; sábados de 9:30 a 13:00. Grupos, confirmar.', { ubicacion: p(37.254515, -7.204407), direccion: 'C/ Rinconá, 13', telefono: '619 47 29 11', fuente: 'poi/casa-museo-castillo-de-lepe' }],
  ['turismo_cultural', 'Museo - Casa Hermandad de Nuestra Señora de La Bella', 'Muestra en vitrinas el patrimonio artístico de la hermandad: la carreta-templete de la Virgen, el paso procesional con su antigua peana, mantos y toquillas, candelabros de finales del siglo XIX, el manto de salida de terciopelo burdeos con bordados en oro, el estandarte y la bandera de la corporación y los arcángeles tenantes del escultor sevillano Ricardo Rivera. Visitas guiadas de martes a sábado de 10:30 a 13:30; grupos y otros horarios, avisando antes.', { ubicacion: p(37.25416, -7.204882), direccion: 'Calle de la Iglesia, 30', telefono: '959 38 36 05', fuente: 'poi/museo-casa-hermandad-de-nuestra-se-ora-de-la-bella' }],
  ['turismo_cultural', 'John Holland Gallery', 'Galería de arte sin ánimo de lucro de la Asociación Cultural Pintor Santana, para impulsar las artes plásticas en Lepe y en la provincia de Huelva. Combina exposiciones de corrientes como el realismo, el surrealismo o el arte abstracto, de colecciones privadas y de artistas concretos. Ocupa una de las casas más antiguas y bonitas de Lepe, restaurada por sus fundadores.', { ubicacion: p(37.255674, -7.202171), direccion: 'C/ Real, 26', telefono: '646 677 913', web: 'http://www.johnhollandgallery.com', fuente: 'poi/john-holland-gallery' }],
  ['turismo_cultural', 'Ajimez', 'Ventana mudéjar declarada Bien de Interés Cultural en 1985: un parteluz central sostiene dos arcos carpaneles enmarcados por azulejería. Pertenecía a la fachada de la "Casa Grande" de la calle Oria Castañeda y es lo único que se conserva del edificio, que se demolió para construir la Casa de la Cultura. Hoy está reconstruido en la fachada de la biblioteca.', { ubicacion: p(37.253286, -7.203041), direccion: 'Calle Oria Castañeda, 36', fuente: 'poi/ajimez' }],
  ['turismo_cultural', 'Teatro Alcalde Juan Manuel Santana', 'Teatro del barrio de La Arboleda, presentado como uno de los espacios culturales más modernos de Andalucía. Tiene un escenario versátil junto a un foso para 50 músicos, 600 butacas ampliables a 650, cabinas de radio y televisión, vestíbulos y sala de exposiciones permanente. Sus aulas acogen talleres municipales de pintura, artesanía, fotografía, música y teatro.', { ubicacion: p(37.256877, -7.209289), direccion: 'Av. Arboleda, s/n', telefono: '959 64 51 49', fuente: 'poi/teatro-alcalde-juan-manuel-santana' }],
  ['turismo_cultural', 'Ermita de Nuestra Señora de la Bella', 'Ermita construida en el siglo XX que acoge la imagen de Nuestra Señora de la Bella durante la romería, el segundo fin de semana de mayo. Tiene planta de cruz latina, torre campanario adosada y escalinata de entrada. Está a los pies del cabezo de La Bella, desde donde se ve todo el recinto romero y las marismas del río Piedras.', { ubicacion: p(37.224581, -7.184711), direccion: 'Plaza Convento de la Bella', fuente: 'poi/ermita-de-nuestra-se-ora-de-la-bella' }],
  ['turismo_cultural', 'Capilla Cristo del Mar', 'Capilla de 1972 en el barrio de Don Ramiro. Alberga el Cristo del Mar, talla anónima del primer tercio del siglo XVI procedente del antiguo convento de la Piedad y restaurada en 1975 por Antonio León Ortega; la Entrada Triunfal en Jerusalén (León Ortega, 1966), Jesús Cautivo y la Virgen de la Paz. El altar mayor procede de la antigua iglesia de Santo Domingo de Guzmán.', { ubicacion: p(37.258198, -7.205439), direccion: 'Calle Jesús, 4', telefono: '959 38 43 27', fuente: 'poi/capilla-cristo-del-mar' }],
  ['turismo_cultural', 'Capilla del Carmen', 'Capilla de advocación marinera en el barrio de la Pendola. Su titular es la Virgen del Carmen, escultura de madera policromada tallada por León Ortega en 1954 y restaurada por él mismo en 1978.', { ubicacion: p(37.260922, -7.19758), direccion: 'Calle Carmelitas, 9', telefono: '959 38 02 40', fuente: 'poi/capilla-del-carmen' }],
  ['turismo_cultural', 'Plaza de España', 'El corazón de Lepe, donde confluyen las calles principales. La rodean los dos edificios más importantes del pueblo, el Ayuntamiento y la iglesia parroquial de Santo Domingo de Guzmán, junto a casas de estilo tradicional andaluz.', { ubicacion: p(37.254407, -7.203181), fuente: 'poi/plaza-de-espa' }],
  ['turismo_cultural', 'Plaza San Diego', 'Plaza remodelada sobre la antigua, en los que fueron los arrabales del pueblo, conocida como "El Llano". Su diseño se centra en la jardinería y en bancos de ladrillo sevillano y azulejos que representan momentos de la historia de Lepe.', { ubicacion: p(37.25574, -7.20668), fuente: 'poi/plaza-san-diego' }],
  ['turismo_cultural', 'Parque de la Estación', 'Parque sobre el antiguo trazado del ferrocarril Gibraleón-Ayamonte, del que toma el nombre. De planta rectangular, tiene muchos parterres con especies vegetales de la provincia de Huelva y el Monumento al agricultor. Aquí se rodó el cortometraje "Despierta", sobre niños con discapacidad, premiado en numerosos festivales.', { ubicacion: p(37.259931, -7.201748), fuente: 'poi/parque-de-la-estaci-n' }],
  ['turismo_cultural', 'Parque del V Centenario', 'Parque en la entrada norte de Lepe con un conjunto escultórico de Francisca Abreu que rinde homenaje a los marineros leperos que participaron en el descubrimiento de América, en especial a Rodrigo de Triana, el primero en avistar tierra en la expedición de Colón, a quien algunos autores vinculan con Lepe.', { ubicacion: p(37.264615, -7.196779), direccion: 'Av. del Descubrimiento', fuente: 'poi/parque-del-v-centenario' }],
  ['turismo_cultural', 'Monumento a Nuestra Señora de La Bella y la ancianidad', 'Obra del escultor José Manuel Martínez en la Huerta del Pozo. Con metáforas expresa la relación del pueblo con su patrona y las distintas actitudes de los mayores tras una larga vida: en la base, una anciana serena; a su derecha, un anciano risueño con un niño en brazos ofrece a la Virgen una paloma, símbolo del Espíritu Santo.', { ubicacion: p(37.249144, -7.20481), direccion: 'Calle Valle Taray, 2', fuente: 'poi/monumento-nuestra-se-ora-de-la-bella-y-la-ancianidad' }],
  ['turismo_cultural', 'Monumento a la Coronación Canónica', 'En el parque de la Coronación, conmemora la coronación canónica de la Virgen de la Bella el 2 de junio de 1992, hecho que da nombre al parque.', { ubicacion: p(37.255593, -7.208542), fuente: 'poi/monumento-la-coronaci-n-can-nica' }],
  ['turismo_cultural', 'Monumento a Álvaro Alonso Barba', 'En el parque de la Coronación, homenajea al ilustre metalúrgico lepero Álvaro Alonso Barba con la reproducción de un horno de fundición como los que describe en su obra "El Arte de los Metales".', { ubicacion: p(37.254235, -7.206978), fuente: 'poi/monumento-lvaro-alonso-barba' }],
  ['turismo_cultural', 'Monumento al marinero (rotonda)', 'Segundo monumento dedicado a la gente de la mar, con la figura de un marinero faenando, en una rotonda de la N-431 junto a la urbanización El Campú. Muestra que Lepe honra un oficio que tanto le ha dado.', { ubicacion: p(37.25294, -7.211218), direccion: 'Rotonda de la N-431, junto a la urbanización El Campú', fuente: 'poi/monumento-al-marinero-rotonda' }],
  ['turismo_cultural', 'Museo al aire libre de La Antilla', 'Exposición en el paseo marítimo de La Antilla que representa ciudades españolas con réplicas y monumentos donados: "un paseo por la geografía española sin salir de La Antilla". Empezó en 2017 para honrar el patrimonio histórico, sumar un atractivo y reducir la estacionalidad. Incluye 100 m de la barandilla de La Concha de San Sebastián (donada en 2019), una Menina de Madrid de Antonio Azzato, la "Regaora" de Córdoba, réplica en bronce de José Manuel Belmonte, y El Socorrista de Biarritz, de Aurora Cañero.', { ubicacion: p(37.205168, -7.217728), direccion: 'Paseo marítimo de La Antilla', fuente: 'poi/museo-al-aire-libre-de-la-antilla' }],
  ['turismo_cultural', 'Mercado Municipal', 'Mercado de productos de alimentación de primera necesidad en el centro de Lepe.', { ubicacion: p(37.253992, -7.204009), direccion: 'Calle Iglesia, 1', fuente: 'poi/mercado-municipal' }],
  ['turismo_cultural', 'Zampuzos de Lepe', 'Lepe siempre ha estado ligado a la pesca y a la agricultura. Su vino, ya citado en los Cuentos de Canterbury, y sus higos fueron fuente de riqueza. Mientras los acomodados se reunían en los casinos, la gente llana lo hacía en las tabernas llamadas zampuzos, el principal lugar para charlar y beber vino. Aún se conserva el estilo de estos pequeños zampuzos, y cada dueño vive la vendimia de septiembre como un ritual: pisa la uva en su local y elabora el vino en sus propias barricas.', { fuente: 'poi/zampuzos-de-lepe' }],
  ['turismo_cultural', 'Fiestas patronales en honor a la Virgen de la Bella y San Roque', 'Se celebran el 14, 15 y 16 de agosto y nacieron en el siglo XIX, cuando se concedió una feria a la villa que con el tiempo perdió su función comercial. El 15 sale en procesión por el centro la Virgen de la Bella, patrona de Lepe, acompañada de miles de leperos y visitantes; el 16, el grupo scout lleva a San Roque. Hay una gran verbena al aire libre con música en directo, casetas y atracciones, y el Trofeo de fútbol de La Bella.', { fuente: 'poi/fiestas-patronales-en-honor-la-virgen-de-la-bella-y-san-roque' }],
  ['turismo_cultural', 'Romería Chica', 'El fin de semana siguiente a la Romería de la Bella, los fieles llevan el Estandarte de la Virgen al recinto. Durante la romería estuvo en la parroquia, donde permanece hasta la romería del año siguiente. En los últimos años el tercer domingo de mayo se ha convertido en una romería por derecho propio, con ambiente festivo y una participación popular comparable a la de otras de la zona.', { ubicacion: p(37.224541, -7.184444), direccion: 'Plaza Convento de la Bella', fuente: 'poi/romer-chica' }],
  ['turismo_cultural', 'Festividad de la Virgen del Carmen', 'Una de las fiestas más populares de Lepe. El 16 de julio se celebra en la barriada de la Pendola, con una gala de elección de reinas infantil y juvenil, una gran verbena y una procesión de la Virgen. En La Antilla se celebra en el barrio de los Pescadores: tras la misa, los pescadores sacan a la Virgen en barco por el mar y por la tarde los devotos la llevan a hombros por la orilla hasta su capilla, ante miles de veraneantes.', { fuente: 'poi/festividad-de-la-virgen-del-carmen' }],
  ['turismo_cultural', 'Carnaval', 'El carnaval lepero, en auge en los últimos años, ofrece galas de Carnaval, la Habá con Chocos, la gala de pregón y coronación, carnaval de calle, pasacalles y el tradicional entierro del Jigo.', { fuente: 'poi/carnaval' }],
  ['turismo_cultural', 'Navidad', 'La Navidad lepera atrae cada año a más visitantes por la variedad de su programa. Lo más llamativo es la nevada artificial en un enclave emblemático del municipio, a la que asisten miles de personas. El 30 de diciembre se hace además un ensayo de las campanadas de Nochevieja en el centro, con uvas, cotillón y música.', { fuente: 'poi/navidad' }],
  ['turismo_cultural', 'Cabalgata de Reyes', 'El 5 de enero los Reyes Magos recorren las calles de Lepe en sus carrozas repartiendo caramelos a los niños, acompañados de carrozas temáticas con luz, color y música.', { fuente: 'poi/cabalgata-de-reyes' }],
  ['turismo_cultural', 'Jornadas Templarias', 'Durante octubre Lepe se convierte en un enclave de los siglos XII y XIII con una recreación medieval en la que participan los vecinos. La plaza de España y sus alrededores cambian de aspecto, con un gran mercado medieval, música en directo, pasacalles, cómicos, cuentacuentos, talleres, recreaciones y circo.', { fuente: 'poi/jornadas-templarias' }],
  ['turismo_cultural', 'Festival Internacional de Cine Bajo la Luna - Islantilla Cinefórum', 'Festival de cine con proyecciones al aire libre en la playa durante julio y agosto, con sesiones nocturnas bajo la luna. En la última semana de agosto se hacen mesas redondas, exposiciones y cursos, y termina con una gala de clausura en la que el jurado entrega los Premios Luna de Islantilla. Lo organiza el Área de Turismo de la Mancomunidad de Islantilla con los ayuntamientos de Lepe e Isla Cristina, la Junta de Andalucía y la Diputación de Huelva, entre otros.', { ubicacion: p(37.204109, -7.229712), direccion: 'Avenida de Río Frío, s/n (Islantilla)', telefono: '959 64 60 28', web: 'http://www.islantillacineforum.com', fuente: 'poi/festival-internacional-de-cine-bajo-la-luna-islantilla-cinef-rum' }],
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
