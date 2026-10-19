import { NavLink } from 'react-router-dom';
import Icono from './Icono.jsx';
import { SECCIONES } from '../router/secciones.js';
import { useAuth } from '../context/AuthContext.jsx';

// Navegación lateral de tablet y escritorio. Las ocho secciones caben
// enteras aquí, que es justo lo que no pasaba con la fila de enlaces que
// había antes: en una ventana estrecha se partía en dos líneas y la barra
// crecía de alto.
//
// Las secciones van en un grupo y lo personal (mensajes, moderación) en
// otro, con su título: mezclarlos haría que "Mensajes" pareciera una
// sección de contenido del pueblo más.
function NavegacionLateral({ pendientesModeracion = 0, tengoSanciones = false }) {
  const { usuario } = useAuth();
  const esEquipo = usuario?.rol === 'moderador' || usuario?.rol === 'admin';

  const clase = ({ isActive }) => (isActive ? 'enlace-nav activo' : 'enlace-nav');

  return (
    <nav className="lateral" aria-label="Navegación principal">
      <ul className="lateral-grupo">
        <li>
          <NavLink to="/" end className={clase}>
            <Icono nombre="muro" />
            Muro
          </NavLink>
        </li>
        {SECCIONES.map((seccion) => (
          <li key={seccion.ruta}>
            <NavLink to={seccion.ruta} className={clase}>
              <Icono nombre={seccion.icono} />
              {seccion.etiqueta}
            </NavLink>
          </li>
        ))}
      </ul>

      {usuario && (
        <>
          <div className="lateral-titulo">Tú</div>
          <ul className="lateral-grupo">
            <li>
              <NavLink to="/mensajes" className={clase}>
                <Icono nombre="mensajes" />
                Mensajes
              </NavLink>
            </li>

            {tengoSanciones && (
              <li>
                <NavLink to="/mi-contenido" className={clase}>
                  <Icono nombre="bandera" />
                  Mi contenido
                </NavLink>
              </li>
            )}

            {esEquipo && (
              <li>
                <NavLink to="/moderacion" className={clase}>
                  <Icono nombre="moderacion" />
                  Moderación
                  {pendientesModeracion > 0 && (
                    <span className="enlace-nav-contador">{pendientesModeracion}</span>
                  )}
                </NavLink>
              </li>
            )}
          </ul>
        </>
      )}
    </nav>
  );
}

export default NavegacionLateral;
