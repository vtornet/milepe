import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon.png'],
      workbox: {
        // El service worker lo genera el plugin y se regenera en cada
        // build, asi que no se puede editar para anadirle los avisos push.
        // Lo que si se puede es pedirle que importe un archivo nuestro
        // (public/push-sw.js), que es lo que atiende 'push' y
        // 'notificationclick'. La alternativa era pasar todo a
        // injectManifest y escribir el service worker entero a mano,
        // incluida la precarga que ahora funciona sola.
        importScripts: ['push-sw.js'],
      },
      manifest: {
        name: 'MiLepe',
        short_name: 'MiLepe',
        description: 'Red social hiperlocal de Lepe (Huelva)',
        // background_color es el fondo de la pantalla de arranque en
        // Android: tiene que coincidir con el fondo sobre el que estan
        // compuestos los iconos (blanco) o el icono aparece recortado
        // sobre otro color al abrir la app.
        theme_color: '#0f6aa6',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            // Android recorta el icono con la forma que use el lanzador
            // (circulo, hexagono...). Sin una entrada 'maskable' mete el
            // icono normal dentro de un cuadro blanco, que es justo lo que
            // hace que una app instalada se vea de aficionado.
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
