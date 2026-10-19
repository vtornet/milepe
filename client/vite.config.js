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
      manifest: {
        name: 'MiLepe',
        short_name: 'MiLepe',
        description: 'Red social hiperlocal de Lepe (Huelva)',
        // Los dos del logo: el negro sobre el que esta dibujado es el
        // fondo de la pantalla de arranque en Android, y asi el icono no
        // aparece recortado sobre un cuadro blanco al abrir la app.
        theme_color: '#0f6aa6',
        background_color: '#000000',
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
