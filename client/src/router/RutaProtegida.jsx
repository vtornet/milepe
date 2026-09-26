import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Envuelve una <Route element={...}> que exige sesion. Si no hay usuario,
// manda a /login guardando de donde veniamos (location.state.desde) para
// que LoginPage pueda devolver ahi mismo tras entrar, en vez de mandar
// siempre al Muro.
function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return null;

  if (!usuario) {
    return <Navigate to="/login" state={{ desde: location.pathname }} replace />;
  }

  return children;
}

export default RutaProtegida;
