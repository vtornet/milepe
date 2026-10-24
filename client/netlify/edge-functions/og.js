// Edge function de Netlify para /p/:id: devuelve el index.html de la SPA con
// las etiquetas Open Graph de esa publicación (ver ../og-html.js). La app
// arranca igual que siempre; lo que cambia es lo que leen los robots de
// WhatsApp y compañía, que no ejecutan JavaScript.
//
// Si algo falla (API caída, id que no existe), se sirve el index.html sin
// tocar: el enlace funciona, solo que la vista previa es la genérica.
import { etiquetasDePublicacion, insertarEtiquetas } from '../og-html.js';

const API = (globalThis.Netlify?.env?.get('VITE_API_URL') || 'https://api.milepe.com/api').replace(/\/$/, '');

export default async (request, context) => {
  const respuesta = await context.next();

  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/')[2];
    if (!/^[a-f0-9]{24}$/i.test(id || '')) return respuesta;

    const datos = await fetch(`${API}/posts/${id}`, { signal: AbortSignal.timeout(2500) });
    if (!datos.ok) return respuesta;
    const { post } = await datos.json();

    const html = await respuesta.text();
    const etiquetas = etiquetasDePublicacion(post, {
      urlPagina: `${url.origin}/p/${id}`,
      imagenPorDefecto: `${url.origin}/icons/compartir.png`,
    });

    return new Response(insertarEtiquetas(html, etiquetas), {
      status: respuesta.status,
      headers: { ...Object.fromEntries(respuesta.headers), 'content-type': 'text/html; charset=utf-8' },
    });
  } catch {
    return respuesta;
  }
};

export const config = { path: '/p/*' };
