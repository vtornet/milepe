import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api.js';
import { useAuth } from './AuthContext.jsx';

const comoMapa = (usuarios = []) =>
  Object.fromEntries(usuarios.filter(Boolean).map((usuario) => [String(usuario._id), true]));

const SeguimientosContext = createContext(null);

// A quién sigo y quién me sigue, pedido una vez por carga de la
// aplicación.
//
// Hacen falta las dos listas y no solo la primera, porque lo que decide si
// dos vecinos pueden escribirse es el seguimiento MUTUO: con "a quién
// sigo" no se puede pintar un botón de mensaje sin preguntar al servidor
// una vez por tarjeta.
//
// Mismo patrón que ReaccionesContext y por el mismo motivo: el botón de
// seguir aparece en cada publicación del muro, y una petición por botón
// serían veinte peticiones para pintar una pantalla.
export function SeguimientosProvider({ children }) {
  const { usuario } = useAuth();

  const [sigo, setSigo] = useState({});
  const [meSiguen, setMeSiguen] = useState({});

  useEffect(() => {
    if (!usuario) {
      setSigo({});
      setMeSiguen({});
      return undefined;
    }

    let cancelado = false;

    Promise.all([api.get('/seguimientos/siguiendo'), api.get('/seguimientos/seguidores')])
      .then(([siguiendo, seguidores]) => {
        if (cancelado) return;
        setSigo(comoMapa(siguiendo.data.usuarios));
        setMeSiguen(comoMapa(seguidores.data.usuarios));
      })
      // Un fallo aquí no se enseña, igual que en las reacciones: lo que se
      // pierde es que un botón diga "Seguir" cuando ya le sigues, y el
      // servidor lo corrige en cuanto se pulsa (seguir es idempotente).
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, [usuario]);

  // Se guarda lo que contesta el servidor, que devuelve el estado completo
  // (sigo / me sigue / mutuo) después de cada cambio. Así dos botones de
  // la misma persona -su ficha y su publicación en el muro- no pueden
  // contradecirse.
  const aplicar = useCallback((otroId, estado) => {
    const clave = String(otroId);

    setSigo((anterior) => {
      const copia = { ...anterior };
      if (estado.sigo) copia[clave] = true;
      else delete copia[clave];
      return copia;
    });

    setMeSiguen((anterior) => {
      const copia = { ...anterior };
      if (estado.me_sigue) copia[clave] = true;
      else delete copia[clave];
      return copia;
    });
  }, []);

  const seguir = useCallback(
    async (otroId) => {
      const { data } = await api.post(`/seguimientos/${otroId}`);
      aplicar(otroId, data);
      return data;
    },
    [aplicar],
  );

  const dejarDeSeguir = useCallback(
    async (otroId) => {
      const { data } = await api.delete(`/seguimientos/${otroId}`);
      aplicar(otroId, data);
      return data;
    },
    [aplicar],
  );

  const relacionCon = useCallback(
    (otroId) => {
      const clave = String(otroId);
      const leSigo = Boolean(sigo[clave]);
      const meSigue = Boolean(meSiguen[clave]);
      return { sigo: leSigo, me_sigue: meSigue, mutuo: leSigo && meSigue };
    },
    [sigo, meSiguen],
  );

  const valor = useMemo(
    () => ({ relacionCon, seguir, dejarDeSeguir, aplicar }),
    [relacionCon, seguir, dejarDeSeguir, aplicar],
  );

  return <SeguimientosContext.Provider value={valor}>{children}</SeguimientosContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSeguimientos() {
  const contexto = useContext(SeguimientosContext);
  if (!contexto) throw new Error('useSeguimientos() se ha usado fuera de SeguimientosProvider');
  return contexto;
}
