// Lo que necesita un buscador en las páginas públicas, metido en el
// index.html de la SPA antes de que llegue al navegador: título,
// descripción, URL canónica, el contenido real en HTML y datos
// estructurados (schema.org) de eventos, negocios y lugares turísticos.
//
// El contenido va DENTRO de <div id="root">: React lo sustituye al arrancar
// (createRoot vacía el contenedor), así que la persona ve la app de siempre
// y quien no ejecuta JavaScript —o lo hace tarde— lee lo mismo en HTML. Es
// el mismo contenido para todos: no se sirve otra cosa a los robots.
//
// Código puro (sin Deno ni Netlify) para probarlo con node desde
// server/test/seo.test.js; lo usa la edge function edge-functions/seo.js.
import { etiquetasDePublicacion, insertarEtiquetas, resumir } from './og-html.js';
import { SECCIONES_TURISMO, SECCION_TURISMO_POR_VALOR } from '../src/pages/Turismo/seccionesTurismo.js';

const escaparHtml = (texto = '') =>
  String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Secciones con su texto para buscadores. `api` es lo que hay que pedir para
// pintar su contenido (sin `api`, la página lleva solo la descripción).
export const PAGINAS_SEO = {
  '/quejas': { titulo: 'Quejas', descripcion: 'Quejas y avisos de los vecinos de Lepe al Ayuntamiento: baches, limpieza, alumbrado, obras. Con su estado y la respuesta municipal.' },
  '/eventos': { titulo: 'Eventos', descripcion: 'Agenda de Lepe: fiestas, conciertos, ferias, deportes y cultura. Qué hacer en Lepe, La Antilla e Islantilla.', api: '/eventos?limite=30' },
  '/negocios': { titulo: 'Negocios locales', descripcion: 'Bares, restaurantes, comercios y servicios de Lepe, con dirección, teléfono, horario y opiniones de los vecinos.', api: '/negocios?limite=50' },
  '/turismo': { titulo: 'Turismo', descripcion: 'Qué ver en Lepe: playas de La Antilla e Islantilla, rutas, monumentos, gastronomía y alojamientos.' },
  '/fotos': { titulo: 'Fotos', descripcion: 'Fotos antiguas y actuales de Lepe compartidas por sus vecinos.' },
  '/avisos': { titulo: 'Avisos', descripcion: 'Avisos oficiales en Lepe: cortes de agua y de tráfico, obras, bandos y emergencias.' },
  '/tablon': { titulo: 'Tablón de anuncios', descripcion: 'Compraventa, regalos, objetos perdidos y ayuda entre vecinos de Lepe.' },
  '/animales': { titulo: 'Animales', descripcion: 'Animales perdidos y encontrados en Lepe, adopciones y casas de acogida. Aquí no se venden animales.' },
  '/empleo': { titulo: 'Empleo', descripcion: 'Ofertas de trabajo y personas que buscan empleo en Lepe: campo, hostelería, construcción y comercio.' },
  '/encuestas': { titulo: 'Encuestas', descripcion: 'Encuestas y consultas entre los vecinos de Lepe.' },
  '/grupos': { titulo: 'Grupos', descripcion: 'Grupos de Lepe: barrios, asociaciones, hermandades, peñas y clubes.' },
  '/tiempo': { titulo: 'El tiempo en Lepe', descripcion: 'El tiempo en Lepe hoy y los próximos días, mareas, temperatura del agua e índice UV en La Antilla.' },
  '/farmacias': { titulo: 'Farmacias de guardia', descripcion: 'Farmacias de guardia en Lepe hoy y mañana, con horario, dirección y teléfono.' },
  '/contactos': { titulo: 'Teléfonos de interés', descripcion: 'Teléfonos de interés de Lepe: emergencias, Ayuntamiento, Policía Local, centros de salud, colegios y más.', api: '/contactos-interes' },
};

for (const s of SECCIONES_TURISMO) {
  PAGINAS_SEO[`/turismo/${s.valor}`] = {
    titulo: `${s.etiqueta} · Turismo en Lepe`,
    descripcion: s.descripcion,
    api: `/turismo?seccion=${s.valor}`,
  };
}

const LEPE = { '@type': 'PostalAddress', addressLocality: 'Lepe', addressRegion: 'Huelva', addressCountry: 'ES' };
const direccion = (calle) => (calle ? { ...LEPE, streetAddress: calle } : LEPE);
const geo = (u) => (u?.lat != null && u?.lng != null ? { '@type': 'GeoCoordinates', latitude: u.lat, longitude: u.lng } : undefined);
const sinVacios = (objeto) => JSON.parse(JSON.stringify(objeto));

const fechaLegible = (iso) =>
  new Date(iso).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' });

// Lo que se pinta (y lo que se cuenta a Google) de cada tipo de dato.
const LISTAS = {
  eventos: (datos, origen) => ({
    elementos: datos.eventos.map((e) => ({
      titulo: e.titulo,
      enlace: `/p/${e._id}`,
      lineas: [fechaLegible(e.fecha_inicio), e.lugar, resumir(e.contenido, 160)],
    })),
    jsonLd: datos.eventos.map((e) =>
      sinVacios({
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: e.titulo,
        description: resumir(e.contenido, 300),
        startDate: e.fecha_inicio,
        endDate: e.fecha_fin || undefined,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: { '@type': 'Place', name: e.lugar || 'Lepe', address: LEPE, geo: geo(e.ubicacion) },
        image: e.imagenes?.[0],
        url: `${origen}/p/${e._id}`,
      }),
    ),
  }),
  negocios: (datos, origen) => ({
    elementos: datos.negocios.map((n) => ({
      titulo: n.titulo,
      enlace: `/p/${n._id}`,
      lineas: [n.direccion, n.telefono, n.horario, resumir(n.contenido, 160)],
    })),
    jsonLd: datos.negocios.map((n) =>
      sinVacios({
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: n.titulo,
        description: resumir(n.contenido, 300),
        address: direccion(n.direccion),
        telephone: n.telefono || undefined,
        geo: geo(n.ubicacion),
        url: n.sitio_web || `${origen}/p/${n._id}`,
      }),
    ),
  }),
  recursos: (datos) => ({
    elementos: datos.recursos.map((r) => ({
      titulo: r.titulo,
      lineas: [r.direccion, r.telefono, resumir(r.descripcion, 300)],
    })),
    jsonLd: datos.recursos.map((r) =>
      sinVacios({
        '@context': 'https://schema.org',
        '@type': 'TouristAttraction',
        name: r.titulo,
        description: resumir(r.descripcion, 300),
        address: direccion(r.direccion),
        telephone: r.telefono || undefined,
        geo: geo(r.ubicacion),
        image: r.imagenes?.[0],
        url: r.web || undefined,
      }),
    ),
  }),
  contactos: (datos) => ({
    elementos: datos.contactos.map((c) => ({ titulo: c.nombre, lineas: [c.telefono, c.direccion, c.horario] })),
    jsonLd: [],
  }),
};

const listaDe = (datos, origen) => {
  const clave = Object.keys(LISTAS).find((k) => Array.isArray(datos?.[k]));
  return clave ? LISTAS[clave](datos, origen) : { elementos: [], jsonLd: [] };
};

// Enlaces a las demás secciones: lo que deja a un buscador recorrer el sitio
// desde cualquier página.
const navegacion = () =>
  `<nav><ul>${Object.entries(PAGINAS_SEO)
    .filter(([ruta]) => !ruta.startsWith('/turismo/'))
    .map(([ruta, p]) => `<li><a href="${ruta}">${escaparHtml(p.titulo)}</a></li>`)
    .join('')}</ul></nav>`;

const htmlDeElementos = (elementos) =>
  elementos.length === 0
    ? ''
    : `<ul>${elementos
        .map((e) => {
          const titulo = e.enlace ? `<a href="${e.enlace}">${escaparHtml(e.titulo)}</a>` : escaparHtml(e.titulo);
          const lineas = e.lineas.filter(Boolean).map((l) => `<p>${escaparHtml(l)}</p>`).join('');
          return `<li><h2>${titulo}</h2>${lineas}</li>`;
        })
        .join('')}</ul>`;

// La página de una ruta pública, con los datos de la API si los tiene.
// Devuelve null si la ruta no es una de las públicas.
export const paginaDeRuta = (ruta, datos, origen) => {
  const pagina = PAGINAS_SEO[ruta];
  if (!pagina) return null;
  const { elementos, jsonLd } = listaDe(datos, origen);

  let extra = '';
  if (ruta === '/turismo') {
    extra = `<ul>${SECCIONES_TURISMO.map(
      (s) => `<li><h2><a href="/turismo/${s.valor}">${escaparHtml(s.etiqueta)}</a></h2><p>${escaparHtml(s.descripcion)}</p></li>`,
    ).join('')}</ul>`;
  }
  const seccionTurismo = SECCION_TURISMO_POR_VALOR[ruta.split('/')[2]];
  const volver = seccionTurismo ? '<p><a href="/turismo">Turismo en Lepe</a></p>' : '';

  return {
    titulo: `${pagina.titulo} · MiLepe`,
    descripcion: pagina.descripcion,
    canonica: `${origen}${ruta}`,
    contenido:
      `<main><h1>${escaparHtml(pagina.titulo)}</h1><p>${escaparHtml(pagina.descripcion)}</p>` +
      `${volver}${extra}${htmlDeElementos(elementos)}</main>${navegacion()}`,
    jsonLd,
    og: [
      ['og:type', 'website'],
      ['og:site_name', 'MiLepe'],
      ['og:title', pagina.titulo],
      ['og:description', pagina.descripcion],
      ['og:url', `${origen}${ruta}`],
      ['og:image', `${origen}/icons/compartir.png`],
      ['og:locale', 'es_ES'],
      ['twitter:card', 'summary'],
    ],
  };
};

// Una publicación (/p/:id): las etiquetas de compartir de siempre, más su
// texto en HTML.
export const paginaDePublicacion = (post, origen) => {
  const { titulo, etiquetas, descripcion } = etiquetasDePublicacion(post, {
    urlPagina: `${origen}/p/${post._id}`,
    imagenPorDefecto: `${origen}/icons/compartir.png`,
  });
  const autor = post.autor_id?.nombre_usuario;
  return {
    titulo,
    descripcion,
    canonica: `${origen}/p/${post._id}`,
    contenido:
      `<main><article><h1>${escaparHtml(post.titulo || 'Publicación en MiLepe')}</h1>` +
      `${autor ? `<p>Publicado por ${escaparHtml(autor)}</p>` : ''}` +
      `${String(post.contenido || '')
        .split(/\n{2,}/)
        .map((p) => `<p>${escaparHtml(p)}</p>`)
        .join('')}</article></main>${navegacion()}`,
    jsonLd: [],
    og: etiquetas,
  };
};

// JSON dentro de <script>: un "</script>" en un texto cerraría la etiqueta.
const jsonEnScript = (valor) => JSON.stringify(valor).replace(/</g, '\\u003c');

export const insertarPagina = (html, pagina) => {
  let resultado = insertarEtiquetas(html, { titulo: pagina.titulo, etiquetas: pagina.og, descripcion: pagina.descripcion });
  const cabecera = [
    `<link rel="canonical" href="${escaparHtml(pagina.canonica)}" />`,
    ...pagina.jsonLd.map((d) => `<script type="application/ld+json">${jsonEnScript(d)}</script>`),
  ].join('\n    ');
  resultado = resultado.replace('</head>', `    ${cabecera}\n  </head>`);
  // En su propio contenedor: los estilos de index.html van acotados a él y no
  // tocan a la app cuando arranca.
  return resultado.replace('<div id="root"></div>', `<div id="root"><div class="seo-previo">${pagina.contenido}</div></div>`);
};
