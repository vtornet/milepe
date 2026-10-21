import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icono from './Icono.jsx';
import Avatar from './Avatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTema } from '../hooks/useTema.js';

// Barra superior: marca, buscador y acciones de sesión. Se queda pegada
// arriba con fondo semitransparente y desenfoque, que es lo que hace que se
// sienta "sobre" el contenido en vez de pegada encima.
//
// El buscador se oculta por CSS en pantallas estrechas (ver .buscador): en
// un móvil la barra tiene que dejar sitio al nombre de la aplicación y al
// avatar, y la búsqueda vive en la página de Mensajes y en cada sección.
function BarraSuperior({ pendientesModeracion = 0 }) {
  const { usuario, cargando, logout } = useAuth();
  const { oscuroAhora, alternar } = useTema();
  const navigate = useNavigate();

  const [menuAbierto, setMenuAbierto] = useState(false);

  const esEquipo = usuario?.rol === 'moderador' || usuario?.rol === 'admin';

  const salir = () => {
    setMenuAbierto(false);
    logout();
    navigate('/');
  };

  return (
    <header className="barra">
      <div className="barra-interior">
        <Link to="/" className="marca">
          {/* El pin del logo, sin la palabra "Mi Lepe": a 30 px esa palabra
              no se leería, y además ya va escrita al lado. */}
          <img className="marca-logo" src="/icons/marca.png" alt="" width={30} height={30} />
          MiLepe
        </Link>

        <div className="buscador">
          <span className="buscador-icono">
            <Icono nombre="buscar" tam={17} />
          </span>
          <label className="solo-lectores" htmlFor="buscar-global">
            Buscar en MiLepe
          </label>
          <input
            id="buscar-global"
            type="search"
            placeholder="Buscar en Lepe..."
            onKeyDown={(evento) => {
              // Todavía no hay búsqueda global en el backend (solo
              // /api/usuarios/buscar, que es de vecinos): de momento la
              // tecla manda a Mensajes, donde esa búsqueda sí existe, en
              // vez de dejar un campo que no hace nada.
              if (evento.key === 'Enter' && usuario) navigate('/mensajes');
            }}
          />
        </div>

        <div className="barra-acciones">
          <button
            type="button"
            className="btn-icono"
            onClick={alternar}
            title={oscuroAhora ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            <Icono nombre={oscuroAhora ? 'sol' : 'luna'} />
            <span className="solo-lectores">{oscuroAhora ? 'Modo claro' : 'Modo oscuro'}</span>
          </button>

          {!cargando && usuario && (
            <>
              <Link to="/mensajes" className="btn-icono" title="Mensajes">
                <Icono nombre="mensajes" />
                <span className="solo-lectores">Mensajes</span>
              </Link>

              {esEquipo && (
                <Link
                  to="/moderacion"
                  className="btn-icono btn-icono-aviso"
                  title="Moderación"
                  data-pendientes={pendientesModeracion > 0 ? pendientesModeracion : undefined}
                >
                  <Icono nombre="moderacion" />
                  <span className="solo-lectores">
                    Moderación{pendientesModeracion > 0 ? ` (${pendientesModeracion} pendientes)` : ''}
                  </span>
                </Link>
              )}

              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn-icono"
                  onClick={() => setMenuAbierto(!menuAbierto)}
                  title={usuario.nombre_usuario}
                >
                  <Avatar usuario={usuario} tamano="sm" />
                  <span className="solo-lectores">Tu cuenta</span>
                </button>

                {menuAbierto && (
                  <>
                    {/* Capa invisible a pantalla completa para cerrar al
                        pulsar fuera. Es lo más simple que funciona también
                        con un toque en el móvil, donde no hay blur. */}
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 1 }}
                      onClick={() => setMenuAbierto(false)}
                    />
                    <div className="menu-cuenta">
                      <div className="menu-cuenta-cabecera">
                        <Avatar usuario={usuario} />
                        <div style={{ minWidth: 0 }}>
                          <div className="pub-nombre">{usuario.nombre_usuario}</div>
                          <div className="tarjeta-meta">{usuario.rol}</div>
                        </div>
                      </div>

                      <Link to="/perfil" className="menu-cuenta-opcion" onClick={() => setMenuAbierto(false)}>
                        <Icono nombre="perfil" tam={17} />
                        Mi perfil
                      </Link>

                      <Link to="/mi-contenido" className="menu-cuenta-opcion" onClick={() => setMenuAbierto(false)}>
                        <Icono nombre="bandera" tam={17} />
                        Mi contenido moderado
                      </Link>

                      <button type="button" className="menu-cuenta-opcion" onClick={salir}>
                        <Icono nombre="salir" tam={17} />
                        Cerrar sesión
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {!cargando && !usuario && (
            <>
              <Link to="/login" className="btn btn-plano btn-sm">
                Entrar
              </Link>
              <Link to="/registro" className="btn btn-primario btn-sm">
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default BarraSuperior;
