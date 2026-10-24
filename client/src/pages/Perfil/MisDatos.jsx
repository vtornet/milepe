import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

// RGPD desde el propio perfil: descargar todo lo que MiLepe guarda de ti y
// eliminar la cuenta, sin tener que escribir a nadie.
function MisDatos({ tieneContraseña }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [descargando, setDescargando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [clave, setClave] = useState('');
  const [error, setError] = useState(null);
  const [borrando, setBorrando] = useState(false);

  const descargar = async () => {
    setError(null);
    setDescargando(true);
    try {
      const { data } = await api.get('/usuarios/perfil/exportar');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(blob);
      enlace.download = `milepe-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
      enlace.click();
      URL.revokeObjectURL(enlace.href);
    } catch {
      setError('No se pudieron descargar tus datos.');
    } finally {
      setDescargando(false);
    }
  };

  const eliminar = async (e) => {
    e.preventDefault();
    setError(null);
    setBorrando(true);
    try {
      await api.delete('/usuarios/perfil', {
        data: tieneContraseña ? { contraseña: clave } : { confirmacion: clave.trim() },
      });
      logout();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo eliminar la cuenta.');
      setBorrando(false);
    }
  };

  return (
    <div className="tarjeta" style={{ marginTop: 'var(--e-4)' }}>
      <h2>Tus datos</h2>
      <p className="tarjeta-meta">
        Descarga una copia de todo lo que MiLepe guarda de ti: perfil, publicaciones, comentarios, reacciones,
        seguimientos, mensajes y notificaciones.
      </p>
      <button type="button" className="btn btn-contorno btn-sm" onClick={descargar} disabled={descargando}>
        {descargando ? 'Preparando…' : 'Descargar mis datos'}
      </button>

      <h3 style={{ marginTop: 'var(--e-5)' }}>Eliminar mi cuenta</h3>
      <p className="tarjeta-meta">
        Se retiran tus publicaciones y comentarios, se borran tus reacciones, seguimientos y fotos, y tu cuenta deja
        de existir. Los mensajes que enviaste se quedan en la conversación de la otra persona, sin tu nombre. No se
        puede deshacer.
      </p>

      {confirmando ? (
        <form onSubmit={eliminar}>
          <label htmlFor="baja-confirmacion">
            {tieneContraseña ? 'Escribe tu contraseña para confirmar' : 'Escribe ELIMINAR para confirmar'}
          </label>
          <input
            id="baja-confirmacion"
            type={tieneContraseña ? 'password' : 'text'}
            autoComplete={tieneContraseña ? 'current-password' : 'off'}
            required
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
          <div className="acciones-formulario">
            <button type="submit" className="btn btn-peligro btn-sm" disabled={borrando}>
              {borrando ? 'Eliminando…' : 'Eliminar mi cuenta para siempre'}
            </button>
            <button type="button" className="btn btn-contorno btn-sm" onClick={() => setConfirmando(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-plano btn-sm" onClick={() => setConfirmando(true)}>
          Eliminar mi cuenta
        </button>
      )}

      {error && <p className="mensaje-error">{error}</p>}
    </div>
  );
}

export default MisDatos;
