// Edge function de Netlify para las páginas públicas: devuelve el index.html
// de la SPA con título, descripción, URL canónica, contenido en HTML y datos
// estructurados de esa página (ver ../seo-html.js). En /p/:id además lleva
// las etiquetas Open Graph de la publicación, que es lo que leen WhatsApp y
// compañía al compartir un enlace (sustituye a la antigua og.js).
//
// Si algo falla (API caída o lenta, id que no existe), se sirve lo que se
// pueda: la página sin datos, o el index.html sin tocar. El enlace funciona
// siempre; lo peor que pasa es que el buscador vea menos.
import { paginaDeRuta, paginaDePublicacion, insertarPagina, PAGINAS_SEO } from '../seo-html.js';

const API = (globalThis.Netlify?.env?.get('VITE_API_URL') || 'https://api.milepe.com/api').replace(/\/$/, '');

const pedir = async (ruta) => {
  const r = await fetch(`${API}${ruta}`, { signal: AbortSignal.timeout(2500) });
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
};

// Las cabeceras del original, menos las que describen el cuerpo viejo: con
// un content-length que ya no cuadra el navegador cortaría la página.
const conHtml = (respuesta, html) => {
  const cabeceras = new Headers(respuesta.headers);
  cabeceras.delete('content-length');
  cabeceras.delete('etag');
  cabeceras.set('content-type', 'text/html; charset=utf-8');
  return new Response(html, { status: respuesta.status, headers: cabeceras });
};

export default async (request, context) => {
  const respuesta = await context.next();

  try {
    const url = new URL(request.url);
    const ruta = url.pathname.replace(/\/+$/, '') || '/';

    let pagina = null;
    if (ruta.startsWith('/p/')) {
      const id = ruta.split('/')[2];
      if (!/^[a-f0-9]{24}$/i.test(id || '')) return respuesta;
      const { post } = await pedir(`/posts/${id}`);
      pagina = paginaDePublicacion(post, url.origin);
    } else {
      const api = PAGINAS_SEO[ruta]?.api;
      const datos = api ? await pedir(api).catch(() => null) : null;
      pagina = paginaDeRuta(ruta, datos, url.origin);
    }
    if (!pagina) return respuesta;

    // Una vez leído el cuerpo ya no se puede devolver la respuesta original:
    // si insertar falla, se sirve el HTML tal cual.
    const html = await respuesta.text();
    try {
      return conHtml(respuesta, insertarPagina(html, pagina));
    } catch {
      return conHtml(respuesta, html);
    }
  } catch {
    return respuesta;
  }
};

// Escrita a mano y no sacada de PAGINAS_SEO: Netlify lee esta configuración
// al desplegar y conviene que sea literal. server/test/seo.test.js comprueba
// que coincide con PAGINAS_SEO.
export const config = {
  path: [
    '/p/*',
    '/quejas',
    '/eventos',
    '/negocios',
    '/turismo',
    '/fotos',
    '/avisos',
    '/tablon',
    '/animales',
    '/empleo',
    '/encuestas',
    '/grupos',
    '/tiempo',
    '/farmacias',
    '/contactos',
    '/turismo/sol_y_playa',
    '/turismo/turismo_activo',
    '/turismo/turismo_cultural',
    '/turismo/gastronomia',
    '/turismo/alojamientos',
    '/turismo/servicios_turisticos',
    '/turismo/rutas',
  ],
};
