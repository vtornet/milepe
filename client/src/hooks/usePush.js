import { useCallback, useEffect, useState } from 'react';
import api from '../services/api.js';

// Avisos push del navegador.
//
// Estados posibles:
//   'comprobando'  - todavía no se sabe
//   'no-soportado' - el navegador no puede (iOS sin instalar la PWA, por
//                    ejemplo: ahí Safari solo da push si la aplicación
//                    está añadida a la pantalla de inicio)
//   'denegado'     - el usuario dijo no, y el navegador ya no vuelve a
//                    preguntar: hay que cambiarlo en los ajustes del sitio
//   'inactivo'     - se puede, pero no está activado
//   'activo'       - este navegador está suscrito

const soportado = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

// La clave VAPID viaja en base64 "url-safe" y PushManager la quiere en
// bytes. Es la conversión de siempre: se le devuelven los caracteres que
// base64 normal usa y se rellena a múltiplo de cuatro.
const clavePorBytes = (base64) => {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const crudo = window.atob(normal);
  return Uint8Array.from([...crudo].map((caracter) => caracter.charCodeAt(0)));
};

export default function usePush() {
  const [estado, setEstado] = useState('comprobando');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    const comprobar = async () => {
      if (!soportado()) {
        if (!cancelado) setEstado('no-soportado');
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelado) setEstado('denegado');
        return;
      }

      const registro = await navigator.serviceWorker.getRegistration();
      const suscripcion = await registro?.pushManager.getSubscription();

      if (!cancelado) setEstado(suscripcion ? 'activo' : 'inactivo');
    };

    comprobar().catch(() => {
      if (!cancelado) setEstado('no-soportado');
    });

    return () => {
      cancelado = true;
    };
  }, []);

  const activar = useCallback(async () => {
    setOcupado(true);
    setError(null);

    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        setEstado(permiso === 'denied' ? 'denegado' : 'inactivo');
        return;
      }

      // La clave pública se le pide al servidor en vez de llevarla en el
      // .env del cliente: así no pueden desincronizarse. Una pública que
      // no es pareja de la privada del servidor produce suscripciones que
      // parecen válidas y fallan solo al enviar.
      const { data } = await api.get('/notificaciones/push/clave');
      if (!data.clave) {
        setError('El servidor todavía no tiene configurados los avisos push.');
        return;
      }

      // ready y no getRegistration: al activar los avisos nada más entrar,
      // el service worker puede estar instalándose aún.
      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.subscribe({
        // Sin esto Chrome rechaza la suscripción: no admite avisos
        // silenciosos, que es lo que permitiría usar el push para saber
        // dónde está alguien sin que se entere.
        userVisibleOnly: true,
        applicationServerKey: clavePorBytes(data.clave),
      });

      const { endpoint, keys } = suscripcion.toJSON();
      await api.post('/notificaciones/push', { endpoint, keys });

      setEstado('activo');
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudieron activar los avisos.');
    } finally {
      setOcupado(false);
    }
  }, []);

  const desactivar = useCallback(async () => {
    setOcupado(true);
    setError(null);

    try {
      const registro = await navigator.serviceWorker.getRegistration();
      const suscripcion = await registro?.pushManager.getSubscription();

      if (suscripcion) {
        // Primero se le dice al servidor y luego se cancela en el
        // navegador: si se hiciera al revés y fallase la petición, el
        // servidor seguiría mandando avisos a un endpoint que ya no
        // existe. Así, como mucho, queda una fila que el primer envío
        // fallido borra sola (410).
        await api.delete('/notificaciones/push', { data: { endpoint: suscripcion.endpoint } });
        await suscripcion.unsubscribe();
      }

      setEstado('inactivo');
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudieron desactivar los avisos.');
    } finally {
      setOcupado(false);
    }
  }, []);

  return { estado, ocupado, error, activar, desactivar };
}
