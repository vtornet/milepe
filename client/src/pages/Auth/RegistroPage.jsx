import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const DATOS_INICIALES = { nombre_usuario: '', nombre: '', email: '', contraseña: '' };

// El servidor solo acepta letras, numeros, puntos, guiones y guiones bajos
// en nombre_usuario (sin espacios). En vez de dejar que la gente escriba
// "Juan Perez" y se encuentre con un 400 al enviar, lo vamos limpiando
// mientras escribe: quita tildes (jose -> jose, no jos), cambia espacios
// por "_", y descarta cualquier otro caracter que el servidor rechazaria.
const normalizarNombreUsuario = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');

function RegistroPage() {
  const { registro } = useAuth();
  const navigate = useNavigate();
  const [datos, setDatos] = useState(DATOS_INICIALES);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const manejarCambio = (evento) => {
    const { name, value } = evento.target;
    setDatos({ ...datos, [name]: name === 'nombre_usuario' ? normalizarNombreUsuario(value) : value });
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    setError(null);

    // Comprobacion explicita en JS ademas de required/minLength del <input>:
    // no dependemos solo de la validacion nativa del navegador (autofill,
    // gestores de contraseñas o un envio programatico pueden saltarsela),
    // asi el boton nunca se queda colgado en "Creando cuenta..." esperando
    // una respuesta del servidor que ya sabemos que va a fallar.
    if (datos.contraseña.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (datos.nombre_usuario.length < 3) {
      setError('El nombre de usuario debe tener al menos 3 caracteres.');
      return;
    }

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
          maxLength={30}
          value={datos.nombre_usuario}
          onChange={manejarCambio}
        />
        <small>Sin espacios ni acentos: se convierten solos mientras escribes.</small>

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
