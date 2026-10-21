/* global clients */

// Mitad de service worker que atiende los avisos push.
//
// Es un archivo aparte, en public/, porque el service worker lo genera
// vite-plugin-pwa (modo generateSW) y ese no se puede editar: se
// regenera en cada build. Lo que sí se puede es pedirle que lo importe,
// y es lo que hace workbox.importScripts en vite.config.js. La
// alternativa era pasar todo el PWA a injectManifest y escribir a mano el
// service worker entero, incluida la precarga que ahora funciona sola.
//
// Un service worker no tiene acceso a la aplicación: no sabe quién ha
// entrado ni puede leer el localStorage. Todo lo que necesita para pintar
// el aviso tiene que venir en el propio push, que es lo que manda
// server/src/utils/push.js.

self.addEventListener('push', (evento) => {
  if (!evento.data) return;

  let datos = {};
  try {
    datos = evento.data.json();
  } catch {
    // Un push con un cuerpo que no es JSON no debería existir, pero si
    // llega vale más enseñar algo genérico que no enseñar nada.
    datos = { titulo: 'MiLepe', cuerpo: evento.data.text() };
  }

  const ruta = datos.ruta || '/';

  evento.waitUntil(
    self.registration.showNotification(datos.titulo || 'MiLepe', {
      body: datos.cuerpo || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-32.png',
      // Dos avisos con la misma etiqueta se sustituyen en vez de
      // apilarse: veinte mensajes de la misma conversación son un aviso,
      // no veinte. El servidor manda la misma etiqueta para todo un hilo.
      tag: datos.etiqueta || ruta,
      // Y renotify para que el que sustituye vuelva a avisar, porque si no
      // el segundo mensaje llegaría en silencio.
      renotify: true,
      data: { ruta },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();

  const ruta = evento.notification.data?.ruta || '/';

  evento.waitUntil(
    (async () => {
      const ventanas = await clients.matchAll({ type: 'window', includeUncontrolled: true });

      // Si MiLepe ya está abierta, se reutiliza esa pestaña y se navega
      // dentro. Abrir una segunda ventana de la misma aplicación cada vez
      // que se pulsa un aviso acaba en diez pestañas iguales.
      for (const ventana of ventanas) {
        if (new URL(ventana.url).origin === self.location.origin) {
          await ventana.focus();
          if ('navigate' in ventana) await ventana.navigate(ruta);
          return;
        }
      }

      await clients.openWindow(ruta);
    })(),
  );
});
