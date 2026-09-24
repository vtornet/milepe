import { NavLink } from 'react-router-dom';
import { SECCIONES } from '../router/secciones.js';

/**
 * Navegacion principal. Enlaza el muro (feed general) con cada seccion.
 * Se sustituira por un menu responsive (hamburguesa en movil) mas adelante.
 */
function NavBar() {
  return (
    <nav>
      <NavLink to="/" end>
        MiLepe
      </NavLink>
      {SECCIONES.map((seccion) => (
        <NavLink key={seccion.ruta} to={seccion.ruta}>
          {seccion.etiqueta}
        </NavLink>
      ))}
    </nav>
  );
}

export default NavBar;
