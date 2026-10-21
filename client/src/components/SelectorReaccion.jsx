import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icono from './Icono.jsx';
import { REACCIONES, REACCION_POR_TIPO, REACCION_POR_DEFECTO } from '../utils/reacciones.js';

const MARGEN = 8;
const MS_PULSACION_LARGA = 450;
const MS_ABRIR_AL_PASAR = 350;
const MS_CERRAR_AL_SALIR = 250;

// ¿Hay ratón de verdad? Un móvil no tiene hover, así que allí el selector
// se abre con pulsación larga; en un ordenador, pasando por encima, que es
// donde se espera encontrarlo.
const conRaton = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Botón de reaccionar con su píldora de siete emojis. Lo usan las
// publicaciones y los comentarios (`compacto`), que hablan con endpoints
// distintos pero se comportan igual.
//
// Dos cosas que no son evidentes:
//
// 1. La píldora se dibuja en un PORTAL, no dentro de la tarjeta. La
//    tarjeta (.pub) lleva overflow: hidden -lo necesita para recortar la
//    rejilla de fotos a las esquinas redondeadas-, y la píldora se abre
//    hacia arriba: en una tarjeta corta se salía del recuadro y quedaba
//    cortada, que es justo como se veía el fallo. Con siete emojis, más
//    ancha, sería peor.
// 2. Pulsar sin más da o quita la reacción de siempre; la fila de siete
//    se abre manteniendo pulsado. Abrir siete opciones cada vez que
//    alguien quiere poner un 👍 es cobrarle siete decisiones por una.
function SelectorReaccion({ valor, onElegir, compacto = false, deshabilitado = false }) {
  const [abierto, setAbierto] = useState(false);
  const [recuadro, setRecuadro] = useState(null);
  const [posicion, setPosicion] = useState(null);

  const botonRef = useRef(null);
  const pildoraRef = useRef(null);
  const temporizadorAbrir = useRef(null);
  const temporizadorCerrar = useRef(null);
  // Una pulsación larga acaba disparando también el click; sin esto, al
  // levantar el dedo se abriría la píldora y acto seguido se pondría un
  // "me gusta" sin que nadie lo haya pedido.
  const ignorarClick = useRef(false);

  const elegida = valor ? REACCION_POR_TIPO[valor] : null;

  const limpiarTemporizadores = () => {
    clearTimeout(temporizadorAbrir.current);
    clearTimeout(temporizadorCerrar.current);
  };

  const abrir = useCallback(() => {
    const rect = botonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setRecuadro(rect);
    setAbierto(true);
  }, []);

  const cerrar = useCallback(() => {
    limpiarTemporizadores();
    setAbierto(false);
    setPosicion(null);
  }, []);

  // La posición se calcula midiendo la píldora ya pintada, no estimando su
  // ancho: cambia con el tamaño de pantalla (en un móvil estrecho los
  // botones son más pequeños) y basta un emoji nuevo para que la cuenta
  // dejara de salir.
  useLayoutEffect(() => {
    if (!abierto || !recuadro || !pildoraRef.current) return;

    const { offsetWidth: ancho, offsetHeight: alto } = pildoraRef.current;
    const cabeArriba = recuadro.top > alto + MARGEN;

    setPosicion({
      top: cabeArriba ? recuadro.top - alto - 6 : recuadro.bottom + 6,
      // Pegada al botón, pero sin salirse por ningún lado: con siete
      // emojis la píldora mide casi el ancho de un móvil.
      left: Math.min(Math.max(MARGEN, recuadro.left), Math.max(MARGEN, window.innerWidth - ancho - MARGEN)),
    });
  }, [abierto, recuadro]);

  // Al estar en un portal con posición fija, la píldora no acompaña a la
  // tarjeta: si la página se mueve, se queda flotando donde ya no hay
  // nada. Más vale cerrarla.
  useEffect(() => {
    if (!abierto) return undefined;

    const alTeclear = (evento) => {
      if (evento.key === 'Escape') cerrar();
    };

    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    window.addEventListener('keydown', alTeclear);

    return () => {
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
      window.removeEventListener('keydown', alTeclear);
    };
  }, [abierto, cerrar]);

  useEffect(() => limpiarTemporizadores, []);

  if (deshabilitado) return null;

  const alPulsar = () => {
    if (conRaton()) return;
    temporizadorAbrir.current = setTimeout(() => {
      ignorarClick.current = true;
      abrir();
    }, MS_PULSACION_LARGA);
  };

  const alSoltar = () => clearTimeout(temporizadorAbrir.current);

  const alEntrar = () => {
    if (!conRaton()) return;
    clearTimeout(temporizadorCerrar.current);
    temporizadorAbrir.current = setTimeout(abrir, MS_ABRIR_AL_PASAR);
  };

  // Con retraso, y no al instante: la píldora está 6px por encima del
  // botón, así que el ratón tiene que pasar por fuera de los dos para
  // llegar de uno a otro.
  const alSalir = () => {
    clearTimeout(temporizadorAbrir.current);
    if (!conRaton()) return;
    temporizadorCerrar.current = setTimeout(cerrar, MS_CERRAR_AL_SALIR);
  };

  const alHacerClick = () => {
    if (ignorarClick.current) {
      ignorarClick.current = false;
      return;
    }
    if (abierto) {
      cerrar();
      return;
    }
    // Si ya tenías una, pulsar la quita (el servidor alterna); si no,
    // pone la de siempre.
    onElegir(valor || REACCION_POR_DEFECTO);
  };

  const alTeclearEnBoton = (evento) => {
    // Con teclado no hay pulsación larga ni hover: las flechas abren la
    // fila, que si no sería inalcanzable sin ratón ni dedo.
    if (evento.key === 'ArrowUp' || evento.key === 'ArrowDown') {
      evento.preventDefault();
      abrir();
    }
  };

  const etiqueta = elegida?.etiqueta || 'Reaccionar';

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        className={`${compacto ? 'reaccion-compacta' : 'accion'}${valor ? ' activa' : ''}`}
        aria-haspopup="true"
        aria-expanded={abierto}
        title={elegida ? `${etiqueta} · mantén pulsado para cambiarla` : 'Pulsa para "me gusta", mantén pulsado para elegir'}
        onClick={alHacerClick}
        onPointerDown={alPulsar}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onMouseEnter={alEntrar}
        onMouseLeave={alSalir}
        // Sin esto, mantener pulsado en un móvil saca el menú del
        // navegador (copiar, compartir...) encima de la píldora.
        onContextMenu={(evento) => {
          if (!conRaton()) evento.preventDefault();
        }}
        onKeyDown={alTeclearEnBoton}
      >
        {elegida ? (
          <span className="accion-emoji" aria-hidden="true">
            {elegida.emoji}
          </span>
        ) : (
          <Icono nombre="corazon" tam={compacto ? 14 : 18} />
        )}
        {etiqueta}
      </button>

      {abierto &&
        createPortal(
          <>
            <div className="reacciones-telon" onClick={cerrar} />
            <div
              ref={pildoraRef}
              className="reacciones-menu"
              role="menu"
              aria-label="Elige una reacción"
              style={{
                top: posicion?.top ?? 0,
                left: posicion?.left ?? 0,
                // Mientras no se ha medido, invisible: si no, se vería un
                // salto desde la esquina hasta su sitio.
                opacity: posicion ? 1 : 0,
              }}
              onMouseEnter={() => clearTimeout(temporizadorCerrar.current)}
              onMouseLeave={alSalir}
            >
              {REACCIONES.map((r) => (
                <button
                  key={r.tipo}
                  type="button"
                  role="menuitem"
                  className={r.tipo === valor ? 'elegida' : undefined}
                  title={r.etiqueta}
                  onClick={() => {
                    cerrar();
                    onElegir(r.tipo);
                  }}
                >
                  <span aria-hidden="true">{r.emoji}</span>
                  <span className="solo-lectores">{r.etiqueta}</span>
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

export default SelectorReaccion;
