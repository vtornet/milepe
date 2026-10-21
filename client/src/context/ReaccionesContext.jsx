import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api.js';
import { useAuth } from './AuthContext.jsx';

const SIN_NADA = { posts: {}, comentarios: {} };

const ReaccionesContext = createContext(null);

// Qué ha reaccionado el usuario de la sesión, pedido una sola vez por
// carga de la aplicación (`GET /api/posts/mis-reacciones`).
//
// Antes esto no existía y cada tarjeta arrancaba sin saber nada: al
// recargar la página tu propia reacción no salía marcada, y solo se veía
// hasta que te ibas. Con cuatro emojis se notaba poco; con siete, canta.
//
// Una petición compartida y no un campo "mi_reaccion" en cada listado:
// los siete listados (muro y seis secciones) tendrían que calcularlo cada
// uno -dos de ellos con agregación- y aun así el selector vive dentro de
// una tarjeta que no sabe de qué listado viene. Así funciona igual en
// todas, y en las secciones que se añadan después.
export function ReaccionesProvider({ children }) {
  const { usuario } = useAuth();
  const [mias, setMias] = useState(SIN_NADA);

  useEffect(() => {
    if (!usuario) {
      setMias(SIN_NADA);
      return undefined;
    }

    let cancelado = false;

    api
      .get('/posts/mis-reacciones')
      .then(({ data }) => {
        if (!cancelado) setMias({ posts: data.posts || {}, comentarios: data.comentarios || {} });
      })
      // Un fallo aquí no se enseña. Lo único que se pierde es que tu
      // reacción no aparezca marcada, y un mensaje de error en cada
      // tarjeta del muro por eso sería muchísimo peor que no marcarla.
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, [usuario]);

  // Guarda lo que acaba de contestar el servidor, que es quien alterna.
  // Está aquí y no en cada tarjeta para que dos tarjetas del mismo post
  // -el muro y su sección, abiertos en la misma sesión- no se contradigan.
  const anotar = useCallback((donde, id, tipo) => {
    setMias((anterior) => {
      const copia = { ...anterior[donde] };
      if (tipo) copia[id] = tipo;
      else delete copia[id];
      return { ...anterior, [donde]: copia };
    });
  }, []);

  const valor = useMemo(() => ({ mias, anotar }), [mias, anotar]);

  return <ReaccionesContext.Provider value={valor}>{children}</ReaccionesContext.Provider>;
}

// Falla a gritos si se usa fuera del proveedor, igual que useAuth: un
// undefined silencioso aquí se vería como "nunca he reaccionado a nada".
// eslint-disable-next-line react-refresh/only-export-components
export function useReacciones() {
  const contexto = useContext(ReaccionesContext);
  if (!contexto) throw new Error('useReacciones() se ha usado fuera de ReaccionesProvider');
  return contexto;
}
