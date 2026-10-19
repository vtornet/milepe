Iconos de MiLepe, todos generados a partir de `logo.jpg` (en la raiz del
repositorio) con `sharp`, instalado con `--no-save` y desinstalado despues,
igual que `mongodb-memory-server` en las pruebas del servidor.

- `marca.png` (128px) — el pin del logo para la barra superior. Se recorta
  solo el pin, sin la palabra "Mi Lepe": a 30 px esa palabra no se lee, y
  ademas ya va escrita al lado.
- `favicon-32.png` — pestana del navegador.
- `apple-touch-icon.png` (180px) — pantalla de inicio de iOS. Safari no mira
  el manifest para esto; sin este archivo hace una captura de la pagina y la
  pone de icono.
- `icon-192.png`, `icon-512.png` — `purpose: any` del manifest.
- `icon-512-maskable.png` — `purpose: maskable`, con el pin mas pequeno para
  que quepa en el 80% central: Android lo recorta con la forma del lanzador
  (circulo, hexagono...) y con el tamano normal se comeria la punta del pin.

Todos van sobre negro porque el negro es parte del dibujo: el sol y las olas
se recortan dentro del circulo del pin. Quitarle el fondo dejaria el sol
flotando sobre blanco.

Para rehacerlos tras un cambio de logo: `npm install --no-save sharp`,
recrear el script de generacion (esta en el commit "Logo real de MiLepe"),
ejecutarlo y `npm uninstall sharp`.
