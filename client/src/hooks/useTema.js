import { useCallback, useEffect, useState } from 'react';

const CLAVE = 'milepe_tema';

// Modo claro/oscuro. Tres estados y no dos: 'sistema' (el que tenga el
// movil, que es lo que la mayoria espera), 'claro' y 'oscuro' forzados. Sin
// el estado 'sistema' no habria forma de volver a seguir al telefono una
// vez elegido algo a mano.
//
// El atributo data-tema en <html> es lo que leen los selectores de
// tokens.css; aqui solo se decide su valor.
const leerGuardado = () => {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === 'claro' || valor === 'oscuro' ? valor : 'sistema';
  } catch {
    // Modo privado o almacenamiento bloqueado: se sigue al sistema y no
    // pasa nada mas.
    return 'sistema';
  }
};

export function useTema() {
  const [tema, setTema] = useState(leerGuardado);

  useEffect(() => {
    const raiz = document.documentElement;

    if (tema === 'sistema') {
      raiz.removeAttribute('data-tema');
    } else {
      raiz.setAttribute('data-tema', tema);
    }

    try {
      if (tema === 'sistema') localStorage.removeItem(CLAVE);
      else localStorage.setItem(CLAVE, tema);
    } catch {
      // Que no se pueda recordar la preferencia no debe romper la pagina:
      // sigue aplicada durante esta visita.
    }
  }, [tema]);

  // Lo que el usuario esta viendo ahora mismo, que con 'sistema' depende
  // del movil. Hace falta para saber que icono ensenar en el boton.
  const oscuroAhora =
    tema === 'oscuro' ||
    (tema === 'sistema' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  // El boton alterna entre claro y oscuro explicitos: una vez que alguien
  // lo toca, quiere decidir el, no seguir al sistema.
  const alternar = useCallback(() => {
    setTema(oscuroAhora ? 'claro' : 'oscuro');
  }, [oscuroAhora]);

  return { tema, oscuroAhora, alternar };
}

export default useTema;
