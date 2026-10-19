Iconos de la PWA, generados desde un SVG con `sharp` (instalado con
`--no-save` y desinstalado despues, igual que `mongodb-memory-server` en las
pruebas del servidor):

- `favicon.svg` — pestana del navegador.
- `icon-192.png`, `icon-512.png` — `purpose: any` del manifest.
- `icon-512-maskable.png` — `purpose: maskable`. Va a sangre y con las
  letras dentro del 80% central, porque Android lo recorta con la forma que
  use el lanzador del movil (circulo, hexagono...). Sin esta entrada, el
  sistema mete el icono normal dentro de un cuadro blanco.

Para rehacerlos tras un cambio de logo: recrear el script de generacion
(ver el commit del rediseno), `npm install --no-save sharp`, ejecutarlo, y
`npm uninstall sharp`.
