import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Icono from '../../components/Icono.jsx';

// Pantalla a la que lleva el enlace del correo de verificación. No pide
// nada: coge el token de la URL, lo manda y cuenta cómo ha ido.
function VerificarPage() {
  const { verificarCorreo } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [estado, setEstado] = useState(token ? 'verificando' : 'sin-token');
  const [error, setError] = useState(null);

  // React 18 en modo estricto monta cada efecto dos veces en desarrollo, y
  // el token es de un solo uso: sin este guardia, el segundo intento
  // fallaría y la pantalla diría que el enlace no vale cuando sí valía.
  const yaIntentado = useRef(false);

  useEffect(() => {
    if (!token || yaIntentado.current) return;
    yaIntentado.current = true;

    verificarCorreo(token)
      .then(() => setEstado('listo'))
      .catch((err) => {
        setError(err.response?.data?.mensaje || 'No se ha podido verificar el correo.');
        setEstado('error');
      });
  }, [token, verificarCorreo]);

  return (
    <section className="formulario-auth">
      <img className="marca-auth" src="/icons/marca.png" alt="MiLepe" width={56} height={56} />

      {estado === 'verificando' && (
        <>
          <h1>Verificando...</h1>
          <p className="formulario-auth-sub">Un momento.</p>
        </>
      )}

      {estado === 'listo' && (
        <>
          <h1>Correo confirmado</h1>
          <p className="formulario-auth-sub">Ya puedes publicar, comentar y escribir a otros vecinos.</p>
          <button type="button" className="btn btn-primario btn-bloque" onClick={() => navigate('/', { replace: true })}>
            Entrar en MiLepe
          </button>
        </>
      )}

      {(estado === 'error' || estado === 'sin-token') && (
        <>
          <h1>El enlace no vale</h1>
          <div className="aviso aviso-error">
            <Icono nombre="alerta" tam={18} />
            <span>{error || 'A esta página se llega desde el enlace del correo de verificación.'}</span>
          </div>
          <p className="formulario-auth-sub">
            Los enlaces caducan a las 24 horas y solo se pueden usar una vez. Entra en tu perfil y pide otro.
          </p>
          <Link to="/perfil" className="btn btn-primario btn-bloque">
            Ir a mi perfil
          </Link>
        </>
      )}
    </section>
  );
}

export default VerificarPage;
