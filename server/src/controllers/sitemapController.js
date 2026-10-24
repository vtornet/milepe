import Post from '../models/Post.js';
import Grupo from '../models/Grupo.js';

// sitemap.xml de milepe.com. Lo sirve la API (Netlify lo reescribe desde
// milepe.com/sitemap.xml, ver client/netlify.toml) porque tiene que incluir
// las publicaciones (/p/:id), y esas solo las conoce la base de datos: un
// sitemap estático solo podía listar las secciones.
//
// Las secciones públicas: las mismas que PAGINAS_SEO en
// client/netlify/seo-html.js (que no se puede importar desde aquí: en
// Railway solo se despliega server/). Si añades una, añádela en los dos.
const SECCIONES = [
  ['/', 'hourly'],
  ['/avisos', 'daily'],
  ['/quejas', 'daily'],
  ['/eventos', 'daily'],
  ['/fotos', 'daily'],
  ['/negocios', 'daily'],
  ['/tablon', 'daily'],
  ['/animales', 'daily'],
  ['/empleo', 'daily'],
  ['/encuestas', 'daily'],
  ['/grupos', 'daily'],
  ['/tiempo', 'hourly'],
  ['/farmacias', 'daily'],
  ['/contactos', 'weekly'],
  ['/turismo', 'weekly'],
  ...['sol_y_playa', 'turismo_activo', 'turismo_cultural', 'gastronomia', 'alojamientos', 'servicios_turisticos', 'rutas'].map(
    (s) => [`/turismo/${s}`, 'weekly'],
  ),
  ['/privacidad', 'yearly'],
  ['/condiciones', 'yearly'],
];

// Muy por debajo del máximo del formato (50 000 URL por fichero).
const TOPE_PUBLICACIONES = 5000;
const CACHE_MS = 60 * 60 * 1000;
let cache = null;

const escaparXml = (texto) =>
  String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const url = (base, ruta, { cambio, ultima } = {}) =>
  `  <url><loc>${escaparXml(base + ruta)}</loc>${ultima ? `<lastmod>${ultima.toISOString()}</lastmod>` : ''}${
    cambio ? `<changefreq>${cambio}</changefreq>` : ''
  }</url>`;

export const generarSitemap = async (base) => {
  const [posts, grupos] = await Promise.all([
    Post.find({ estado_moderacion: 'publicado' })
      .sort({ fecha_creacion: -1 })
      .limit(TOPE_PUBLICACIONES)
      .select('_id fecha_actualizacion')
      .lean(),
    Grupo.find({ activo: true }).select('_id fecha_actualizacion').lean(),
  ]);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...SECCIONES.map(([ruta, cambio]) => url(base, ruta, { cambio })),
    ...grupos.map((g) => url(base, `/grupos/${g._id}`, { ultima: g.fecha_actualizacion })),
    ...posts.map((p) => url(base, `/p/${p._id}`, { ultima: p.fecha_actualizacion })),
    '</urlset>',
    '',
  ].join('\n');
};

// Una hora de caché en memoria: los buscadores lo piden de vez en cuando y
// una publicación nueva puede esperar a la siguiente hora.
export const servirSitemap = async (req, res, next) => {
  try {
    const base = (process.env.SITIO_URL || 'https://milepe.com').replace(/\/$/, '');
    if (!cache || Date.now() - cache.en > CACHE_MS || cache.base !== base) {
      cache = { xml: await generarSitemap(base), en: Date.now(), base };
    }
    res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(cache.xml);
  } catch (error) {
    next(error);
  }
};
