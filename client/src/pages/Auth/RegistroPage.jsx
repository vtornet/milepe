import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const DATOS_INICIALES = { nombre_usuario: '', nombre: '', email: '', contraseña: '' };

function RegistroPage() {
  const { registro } = useAuth();
  const navigate = useNavigate();
  const [datos, setDatos] = useState(DATOS_INICIALES);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const manejarCambio = (evento) => {
    setDatos({ ...datos, [evento.target.name]: evento.target.value });
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await registro(datos);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo completar el registro');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="formulario-auth">
      <h1>Crear cuenta</h1>
      <form onSubmit={manejarEnvio}>
        <label htmlFor="nombre_usuario">Nombre de usuario</label>
        <input
          id="nombre_usuario"
          name="nombre_usuario"
          required
          minLength={3}
          value={datos.nombre_usuario}
          onChange={manejarCambio}
        />

        <label htmlFor="nombre">Nombre</label>
        <input id="nombre" name="nombre" required value={datos.nombre} onChange={manejarCambio} />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required value={datos.email} onChange={manejarCambio} />

        <label htmlFor="contraseña">Contraseña (mínimo 8 caracteres)</label>
        <input
          id="contraseña"
          name="contraseña"
          type="password"
          required
          minLength={8}
          value={datos.contraseña}
          onChange={manejarCambio}
        />

        {error && <p className="mensaje-error">{error}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? 'Creando cuenta...' : 'Registrarse'}
        </button>
      </form>
      <p>
        ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
      </p>
    </section>
  );
}

export default RegistroPage;
