// Inserta en el index.html de la SPA las etiquetas Open Graph de una
// publicación, para que WhatsApp, Telegram, Facebook o X enseñen título,
// texto e imagen al compartir un enlace /p/:id. La SPA no puede hacerlo sola:
// esos robots no ejecutan JavaScript, leen el HTML tal cual llega.
//
// Código puro (sin Deno ni Netlify) para poder probarlo con node: lo usa la
// edge function og.js.

const escaparHtml = (texto = '') =>
  String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Una línea de texto para la descripción: sin saltos y cortada por palabra.
export const resumir = (texto = '', max = 200) => {
  const plano = String(texto).replace(/\s+/g, ' ').trim();
  if (plano.length <= max) return plano;
  const corte = plano.slice(0, max);
  return `${corte.slice(0, corte.lastIndexOf(' ') > 80 ? corte.lastIndexOf(' ') : max).trim()}…`;
};

// Una imagen de Cloudinary, a 1200 px de ancho: más pesada no hace falta y
// WhatsApp descarta las muy grandes.
const imagenParaCompartir = (url) =>
  /res\.cloudinary\.com\/.+\/image\/upload\//.test(url || '') ? url.replace('/image/upload/', '/image/upload/w_1200,c_limit/') : url;

export const etiquetasDePublicacion = (post, { urlPagina, imagenPorDefecto }) => {
  const titulo = post.titulo || 'Publicación en MiLepe';
  const imagen = imagenParaCompartir(post.imagenes?.[0]) || imagenPorDefecto;
  const descripcion = resumir(post.contenido) || 'Lo que pasa en Lepe, contado por sus vecinos.';

  return {
    titulo: `${titulo} · MiLepe`,
    etiquetas: [
      ['og:type', 'article'],
      ['og:site_name', 'MiLepe'],
      ['og:title', titulo],
      ['og:description', descripcion],
      ['og:url', urlPagina],
      ['og:image', imagen],
      ['og:locale', 'es_ES'],
      ['twitter:card', post.imagenes?.length ? 'summary_large_image' : 'summary'],
    ],
    descripcion,
  };
};

// Sustituye <title>, la description y las og:* por defecto del index.html por
// las de la publicación.
export const insertarEtiquetas = (html, { titulo, etiquetas, descripcion }) => {
  const meta = etiquetas
    .map(([propiedad, valor]) => {
      const atributo = propiedad.startsWith('twitter:') ? 'name' : 'property';
      return `<meta ${atributo}="${propiedad}" content="${escaparHtml(valor)}" />`;
    })
    .join('\n    ');

  return html
    .replace(/<meta (?:property|name)="(?:og|twitter):[^"]+" content="[^"]*" \/>\s*/g, '')
    .replace(/<title>[^<]*<\/title>/, `<title>${escaparHtml(titulo)}</title>\n    ${meta}`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escaparHtml(descripcion)}" />`);
};
