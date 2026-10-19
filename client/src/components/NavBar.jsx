import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { SECCIONES } from '../router/secciones.js';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';

/**
 * Navegacion principal. Enlaza el muro (feed general) con cada seccion.
 * Se sustituira por un menu responsive (hamburguesa en movil) mas adelante.
 */
function NavBar() {
  const { usuario, cargando, logout } = useAuth();
  const navigate = useNavigate();

  const esEquipo = usuario?.rol === 'moderador' || usuario?.rol === 'admin';
  const [pendientes, setPendientes] = useState(0);
  const [tengoSanciones, setTengoSanciones] = useState(false);

  // Dos consultas al abrir la app, y solo para un usuario con sesion: una
  // dice al equipo cuanto hay esperando, y la otra decide si enseñar el
  // enlace a "Mi contenido". Lo segundo cuesta una peticion para en la
  // mayoria de los casos no enseñar nada, pero la alternativa era poner un
  // enlace fijo con un nombre desagradable en la barra de todo el mundo.
  // Un fallo no se muestra: el enlace simplemente no aparece.
  useEffect(() => {
    if (!usuario) {
      setPendientes(0);
      setTengoSanciones(false);
      return;
    }

    let cancelado = false;

    api
      .get('/moderacion/mi-contenido-moderado')
      .then(({ data }) => {
        if (!cancelado) setTengoSanciones(data.contenido.length > 0);
      })
      .catch(() => {});

    if (esEquipo) {
      api
        .get('/moderacion/resumen')
        .then(({ data }) => {
          if (!cancelado) setPendientes(data.reportes_pendientes + data.apelaciones_pendientes);
        })
        .catch(() => {});
    }

    return () => {
      cancelado = true;
    };
  }, [usuario, esEquipo]);

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
            {esEquipo && (
              <NavLink to="/moderacion">Moderación{pendientes > 0 ? ` (${pendientes})` : ''}</NavLink>
            )}
            {tengoSanciones && <NavLink to="/mi-contenido">Mi contenido</NavLink>}
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
