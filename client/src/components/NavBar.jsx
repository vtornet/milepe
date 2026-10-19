import { NavLink, useNavigate } from 'react-router-dom';
import { SECCIONES } from '../router/secciones.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Navegacion principal. Enlaza el muro (feed general) con cada seccion.
 * Se sustituira por un menu responsive (hamburguesa en movil) mas adelante.
 */
function NavBar() {
  const { usuario, cargando, logout } = useAuth();
  const navigate = useNavigate();

  const manejarLogout = () => {
    logout();
    navigate('/');
  };

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

      <span className="navbar-sesion">
        {!cargando && usuario && (
          <>
            {/* Mensajes no esta en SECCIONES: no es contenido del Muro ni
                tiene un Post.tipo, y solo existe con la sesion abierta.
                Por eso va en el bloque de sesion, no entre las secciones. */}
            <NavLink to="/mensajes">Mensajes</NavLink>
            <span>Hola, {usuario.nombre_usuario}</span>
            <button type="button" onClick={manejarLogout}>
              Cerrar sesión
            </button>
          </>
        )}
        {!cargando && !usuario && (
          <>
            <NavLink to="/login">Iniciar sesión</NavLink>
            <NavLink to="/registro">Registrarse</NavLink>
          </>
        )}
      </span>
    </nav>
  );
}

export default NavBar;
