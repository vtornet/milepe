import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import Icono from '../../components/Icono.jsx';

// Pedir el enlace de recuperación.
//
// El servidor responde siempre lo mismo exista el correo o no (para no ir
// diciendo qué vecinos tienen cuenta), así que esta pantalla hace lo
// propio: enseña el mismo mensaje pase lo que pase. Si dijera "ese correo
// no existe", el cuidado del servidor no habría servido de nada.
function RecuperarPage() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    try {
      await api.post('/auth/recuperar', { email });
      setEnviado(true);
    } catch (err) {
      // Solo fallos de verdad (sin red, servidor caído). Un correo
      // desconocido no llega aquí: el servidor responde 200.
      setError(err.response?.data?.mensaje || 'No se ha podido enviar el correo. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <section className="formulario-auth">
        <img className="marca-auth" src="/icons/marca.png" alt="MiLepe" width={56} height={56} />
        <h1>Mira tu correo</h1>
        <p className="formulario-auth-sub">
          Si <strong>{email}</strong> tiene una cuenta en MiLepe, le hemos enviado un enlace para elegir una
          contraseña nueva.
        </p>

        <div className="aviso aviso-info">
          <Icono nombre="reloj" tam={18} />
          <span>El enlace caduca en una hora y solo se puede usar una vez.</span>
        </div>

        <p className="formulario-auth-pie">
          ¿No te ha llegado? Mira en la carpeta de spam, o{' '}
          <button type="button" className="btn btn-plano btn-sm" onClick={() => setEnviado(false)}>
            prueba con otro correo
          </button>
        </p>
      </section>
    );
  }

  return (
    <section className="formulario-auth">
      <img className="marca-auth" src="/icons/marca.png" alt="MiLepe" width={56} height={56} />
      <h1>Recuperar contraseña</h1>
      <p className="formulario-auth-sub">
        Escribe tu correo y te enviamos un enlace para elegir una contraseña nueva.
      </p>

      <form onSubmit={manejarEnvio}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
        />

        {error && <p className="mensaje-error">{error}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviarme el enlace'}
        </button>
      </form>

      <p className="formulario-auth-pie">
        <Link to="/login">Volver a entrar</Link>
      </p>
    </section>
  );
}

export default RecuperarPage;
