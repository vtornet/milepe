import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [datos, setDatos] = useState({ email: '', contraseña: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Si venimos redirigidos desde una accion que exigia sesion (ver
  // RutaProtegida en AppRouter.jsx), volvemos ahi despues de entrar en vez
  // de mandar siempre al Muro.
  const destinoTrasLogin = location.state?.desde || '/';

  const manejarCambio = (evento) => {
    setDatos({ ...datos, [evento.target.name]: evento.target.value });
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await login(datos.email, datos.contraseña);
      navigate(destinoTrasLogin, { replace: true });
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo iniciar sesion');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="formulario-auth">
      <h1>Iniciar sesión</h1>
      <form onSubmit={manejarEnvio}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required value={datos.email} onChange={manejarCambio} />

        <label htmlFor="contraseña">Contraseña</label>
        <input
          id="contraseña"
          name="contraseña"
          type="password"
          required
          value={datos.contraseña}
          onChange={manejarCambio}
        />

        {error && <p className="mensaje-error">{error}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <p>
        ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
      </p>
    </section>
  );
}

export default LoginPage;
