import { useEffect } from 'react';

// Vuelve a preguntarle al servidor cada cierto tiempo.
//
// Existe para que el día que haya tiempo real de verdad (websockets o SSE)
// haya UN sitio que cambiar y no una copia del setInterval en cada
// pantalla que se refresque. El servidor ya tiene su mitad de esa frontera
// en utils/tiempoReal.js, también sin socket.io instalado todavía: cuando
// se enchufe, este hook se suscribe al evento y el intervalo pasa a ser
// solo la red de seguridad.
//
// Dos cosas que hace y que un setInterval suelto no suele hacer:
//
// - Se detiene cuando la pestaña no se ve. Sondear un chat cerrado en una
//   pestaña de fondo es gastar batería y datos del móvil de un vecino para
//   nada, y al volver se pregunta inmediatamente, así que no se pierde
//   ningún mensaje: solo se deja de preguntar mientras nadie mira.
// - Ignora los fallos. Lo que ya está en pantalla sigue siendo válido y el
//   siguiente intento lo arregla; un aviso de error por un sondeo fallido
//   sería un aviso cada diez segundos con mala cobertura.
export default function useSondeo(tarea, ms, activo = true) {
  useEffect(() => {
    if (!activo || !ms) return undefined;

    let parado = false;
    let intervalo = null;

    const ejecutar = () => {
      if (parado) return;
      Promise.resolve()
        .then(tarea)
        .catch(() => {});
    };

    const arrancar = () => {
      if (intervalo) return;
      intervalo = setInterval(ejecutar, ms);
    };

    const detener = () => {
      clearInterval(intervalo);
      intervalo = null;
    };

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        // Primero se pregunta, luego se reanuda el reloj: al volver a la
        // pestaña lo que se quiere es ver lo nuevo ya, no dentro de diez
        // segundos.
        ejecutar();
        arrancar();
      } else {
        detener();
      }
    };

    if (document.visibilityState === 'visible') arrancar();
    document.addEventListener('visibilitychange', alCambiarVisibilidad);

    return () => {
      parado = true;
      detener();
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [tarea, ms, activo]);
}
