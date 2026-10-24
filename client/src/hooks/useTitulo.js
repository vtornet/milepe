import { useEffect } from 'react';

const TITULO_BASE = 'MiLepe';

// Título de la pestaña (y el que indexa Google, que ejecuta JavaScript):
// "Quejas · MiLepe" en vez de "MiLepe" en todas las páginas. Al salir de la
// página se vuelve al de la portada.
export function useTitulo(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · ${TITULO_BASE}` : TITULO_BASE;
    return () => {
      document.title = TITULO_BASE;
    };
  }, [titulo]);
}
