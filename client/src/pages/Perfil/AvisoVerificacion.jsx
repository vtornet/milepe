import { useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Icono from '../../components/Icono.jsx';

// Aviso de «confirma tu correo» con el botón de reenviar. Aparece en el
// perfil y en la pantalla de alta mientras el correo siga sin verificar.
//
// No se enseña nada si ya está verificado: un aviso permanente que dice
// «todo bien» es ruido que la gente aprende a ignorar, y entonces tampoco
// ve el que sí importa.
function AvisoVerificacion() {
  const { usuario } = useAuth();
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  if (usuario?.email_verificado) return null;

  const reenviar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await api.post('/auth/reenviar-verificacion');
      setEnviado(true);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo reenviar el correo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="aviso aviso-aviso">
      <Icono nombre="alerta" tam={18} />
      <span>
        <strong>Confirma tu correo.</strong> Te hemos enviado un enlace a <strong>{usuario?.email}</strong>.
        Hasta que lo abras podrás mirar MiLepe, pero no publicar.
        {enviado ? (
          <> Te hemos enviado otro enlace.</>
        ) : (
          <>
            {' '}
            <button type="button" className="btn btn-plano btn-sm" onClick={reenviar} disabled={enviando}>
              {enviando ? 'Enviando...' : 'Reenviar'}
            </button>
          </>
        )}
        {error && <span className="mensaje-error"> {error}</span>}
      </span>
    </div>
  );
}

export default AvisoVerificacion;
