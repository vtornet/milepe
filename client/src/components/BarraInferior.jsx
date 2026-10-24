import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Icono from './Icono.jsx';
import { SECCIONES_MENU, rutaDelMenu } from '../router/secciones.js';
import { useAuth } from '../context/AuthContext.jsx';

// Barra de pestañas del móvil. Va abajo y no arriba porque es donde llega
// el pulgar con el teléfono en una mano; un menú en la esquina superior
// izquierda obliga a cambiar el agarre.
//
// Solo caben cuatro pestañas más "Más": con ocho secciones, meterlas todas
// daría iconos de 30 px que nadie acierta. Las dos secciones marcadas como
// principal en secciones.js (Quejas y Eventos, las que más se consultan en
// un pueblo) tienen sitio fijo; el resto están a un toque en la hoja.
function BarraInferior({ noLeidos = 0 }) {
  const { usuario } = useAuth();
  const location = useLocation();
  const [hojaAbierta, setHojaAbierta] = useState(false);

  const principales = SECCIONES_MENU.filter((s) => s.principal);
  const resto = SECCIONES_MENU.filter((s) => !s.principal);
  const enMenu = rutaDelMenu(location.pathname);

  const clase = ({ isActive }) => (isActive ? 'pestana activo' : 'pestana');
  // Dentro de la hoja son filas de menú, no pestañas: misma lista de
  // secciones, otra forma.
  const claseHoja = ({ isActive }) => (isActive ? 'enlace-nav activo' : 'enlace-nav');

  // Si estamos en una sección que vive dentro de "Más", esa pestaña se
  // marca como activa: si no, al abrir Fotos ninguna pestaña quedaría
  // encendida y la barra parecería desconectada de la página.
  const enResto = resto.some((s) => s.ruta === enMenu);

  return (
    <>
      <nav className="barra-inferior" aria-label="Navegación">
        <NavLink to="/" end className={clase}>
          <Icono nombre="muro" tam={22} />
          <span className="pestana-etiqueta">Muro</span>
        </NavLink>

        {principales.map((seccion) => (
          <NavLink key={seccion.ruta} to={seccion.ruta} className={clase}>
            <Icono nombre={seccion.icono} tam={22} />
            <span className="pestana-etiqueta">{seccion.etiqueta}</span>
          </NavLink>
        ))}

        <NavLink to={usuario ? '/mensajes' : '/login'} className={clase}>
          <Icono nombre="mensajes" tam={22} />
          {noLeidos > 0 && <span className="pestana-punto" />}
          <span className="pestana-etiqueta">Mensajes</span>
        </NavLink>

        <button
          type="button"
          className={enResto ? 'pestana activo' : 'pestana'}
          onClick={() => setHojaAbierta(true)}
          style={{ border: 'none', background: 'none', cursor: 'pointer' }}
        >
          <Icono nombre="rejilla" tam={22} />
          <span className="pestana-etiqueta">Más</span>
        </button>
      </nav>

      {hojaAbierta && (
        <div className="velo" onClick={() => setHojaAbierta(false)} role="presentation">
          {/* stopPropagation para que un toque dentro de la hoja no la
              cierre; cerrarla es tocar el velo o una de sus opciones. */}
          <div
            className="hoja"
            onClick={(evento) => evento.stopPropagation()}
            role="dialog"
            aria-label="Más secciones"
          >
            <div className="hoja-asa" />
            <div className="lateral-titulo" style={{ paddingTop: 0 }}>
              Secciones
            </div>
            <ul className="lateral-grupo">
              {resto.map((seccion) => (
                <li key={seccion.ruta}>
                  <NavLink
                    to={seccion.ruta}
                    className={() => claseHoja({ isActive: enMenu === seccion.ruta })}
                    onClick={() => setHojaAbierta(false)}
                  >
                    <Icono nombre={seccion.icono} />
                    {seccion.etiqueta}
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="lateral-titulo">MiLepe</div>
            <ul className="lateral-grupo">
              <li>
                <NavLink to="/privacidad" className={claseHoja} onClick={() => setHojaAbierta(false)}>
                  <Icono nombre="moderacion" />
                  Privacidad
                </NavLink>
              </li>
              <li>
                <NavLink to="/condiciones" className={claseHoja} onClick={() => setHojaAbierta(false)}>
                  <Icono nombre="comprobado" />
                  Condiciones de uso
                </NavLink>
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

export default BarraInferior;
