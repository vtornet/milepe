import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Como RutaProtegida, pero además exige un rol. Para el panel de
// moderación: sin sesión manda a /login, y con sesión pero sin rol manda al
// Muro en vez de enseñar un "no autorizado", porque para un vecino normal
// esa página no es que esté prohibida, es que no existe.
//
// Esto es comodidad de navegación, no seguridad: quien controla de verdad
// es autorizar() en las rutas del servidor. El rol se lee del usuario
// guardado en localStorage y, como cualquier cosa del cliente, se puede
// manipular; lo único que conseguiría es ver un panel vacío cuyas
// peticiones responden 403.
function RutaRol({ roles, children }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return null;

  if (!usuario) {
    return <Navigate to="/login" state={{ desde: location.pathname }} replace />;
  }

  if (!roles.includes(usuario.rol)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default RutaRol;
