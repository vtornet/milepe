Iconos de MiLepe, generados a partir de `logo.png` (en la raiz del
repositorio: el logotipo con fondo transparente) con `sharp`, instalado con
`--no-save` y desinstalado despues, igual que `mongodb-memory-server` en las
pruebas del servidor.

Todos usan **solo el pin**, sin la palabra "Mi Lepe": el logotipo entero
metido en un cuadrado de 32 px no se lee, y donde se usa la marca pequena
(la barra superior) el nombre ya va escrito al lado.

- `marca.png` (alto 128, **transparente**) — barra superior y pantallas de
  entrada. Transparente a proposito: se apoya sobre el fondo que toque y
  funciona igual en modo claro que en oscuro.
- `favicon-32.png` — pestana del navegador.
- `apple-touch-icon.png` (180) — pantalla de inicio de iOS. Safari no mira
  el manifest para esto; sin este archivo hace una captura de la pagina y la
  pone de icono.
- `icon-192.png`, `icon-512.png` — `purpose: any` del manifest.
- `icon-512-maskable.png` — `purpose: maskable`, con el pin mas pequeno para
  que quepa en el 80% central: Android lo recorta con la forma del lanzador
  (circulo, hexagono...) y con el tamano normal se comeria la punta.

Los de sistema (todos menos `marca.png`) van compuestos **sobre blanco** y
no transparentes: iOS compone lo transparente sobre negro por su cuenta, y
este logotipo esta dibujado para fondo claro -el circulo del pin es un
hueco, no una zona negra-. Por eso `background_color` del manifest tambien
es blanco: es el fondo de la pantalla de arranque de Android y tiene que
coincidir con el de los iconos.

Para rehacerlos tras un cambio de logo: `npm install --no-save sharp`,
recrear el script de generacion (esta en el commit "Logo con fondo
transparente"), ejecutarlo y `npm uninstall sharp`.
