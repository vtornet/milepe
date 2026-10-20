import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import BotonGoogle from '../../components/BotonGoogle.jsx';

function LoginPage() {
  const { login, entrarConGoogle } = useAuth();
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

  const conGoogle = async (credential) => {
    setError(null);
    setEnviando(true);
    try {
      await entrarConGoogle(credential);
      navigate(destinoTrasLogin, { replace: true });
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se ha podido entrar con Google');
      setEnviando(false);
    }
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
      {/* Aqui si cabe el logo entero: es la primera pantalla que ve quien
          llega, y el pin solo no dice el nombre del sitio. */}
      <img className="marca-auth" src="/icons/marca.png" alt="MiLepe" width={56} height={56} />
      <h1>Entrar en MiLepe</h1>
      <p className="formulario-auth-sub">La red de los vecinos de Lepe.</p>

      <BotonGoogle onCredencial={conGoogle} />

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

        <p className="enlace-olvido">
          <Link to="/recuperar">¿Has olvidado la contraseña?</Link>
        </p>

        {error && <p className="mensaje-error">{error}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="formulario-auth-pie">
        ¿No tienes cuenta? <Link to="/registro">Créala, es gratis</Link>
      </p>
    </section>
  );
}

export default LoginPage;
