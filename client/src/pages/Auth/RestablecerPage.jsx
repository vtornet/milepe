import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Icono from '../../components/Icono.jsx';

// Elegir la contraseña nueva. Se llega aquí desde el enlace del correo,
// que trae el token en la query: /restablecer?token=...
function RestablecerPage() {
  const { restablecer } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [contraseña, setContraseña] = useState('');
  const [repetida, setRepetida] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    setError(null);

    // Las dos comprobaciones se hacen aquí además de en el servidor: así
    // el error sale al instante y no después de una ida y vuelta. El
    // servidor las repite, claro, porque esto se puede saltar.
    if (contraseña.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (contraseña !== repetida) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setEnviando(true);
    try {
      await restablecer(token, contraseña);
      // El servidor devuelve sesión iniciada, así que se entra directo al
      // muro en vez de mandar otra vez a la pantalla de acceso.
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se ha podido cambiar la contraseña.');
      setEnviando(false);
    }
  };

  // Alguien que abre /restablecer a mano, sin venir del correo.
  if (!token) {
    return (
      <section className="formulario-auth">
        <img className="marca-auth" src="/icons/marca.png" alt="MiLepe" width={56} height={56} />
        <h1>Enlace incompleto</h1>
        <p className="formulario-auth-sub">
          A esta página se llega desde el enlace del correo de recuperación. Comprueba que lo has copiado entero.
        </p>
        <Link to="/recuperar" className="btn btn-primario btn-bloque">
          Pedir un enlace nuevo
        </Link>
      </section>
    );
  }

  return (
    <section className="formulario-auth">
      <img className="marca-auth" src="/icons/marca.png" alt="MiLepe" width={56} height={56} />
      <h1>Elige tu contraseña</h1>
      <p className="formulario-auth-sub">Mínimo 8 caracteres. Al guardarla entrarás directamente.</p>

      <form onSubmit={manejarEnvio}>
        <label htmlFor="contrasena">Contraseña nueva</label>
        <input
          id="contrasena"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={contraseña}
          onChange={(evento) => setContraseña(evento.target.value)}
        />

        <label htmlFor="repetida">Repítela</label>
        <input
          id="repetida"
          type="password"
          required
          autoComplete="new-password"
          value={repetida}
          onChange={(evento) => setRepetida(evento.target.value)}
        />

        {error && (
          <div className="aviso aviso-error" style={{ marginTop: 'var(--e-4)', marginBottom: 0 }}>
            <Icono nombre="alerta" tam={18} />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={enviando}>
          {enviando ? 'Guardando...' : 'Guardar y entrar'}
        </button>
      </form>

      <p className="formulario-auth-pie">
        ¿El enlace ha caducado? <Link to="/recuperar">Pide uno nuevo</Link>
      </p>
    </section>
  );
}

export default RestablecerPage;
