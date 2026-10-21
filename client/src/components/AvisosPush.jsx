import usePush from '../hooks/usePush.js';
import Icono from './Icono.jsx';

// Interruptor de los avisos push, en el perfil.
//
// No se pide el permiso al entrar en MiLepe: un navegador preguntando
// "¿permitir notificaciones?" en el primer segundo es la forma más rápida
// de que alguien diga no para siempre -y el navegador no vuelve a
// preguntar-. Aquí se pide cuando alguien ha ido a buscarlo.
function AvisosPush() {
  const { estado, ocupado, error, activar, desactivar } = usePush();

  if (estado === 'comprobando') return null;

  return (
    <div className="tarjeta-formulario">
      <h2>Avisos en este dispositivo</h2>

      <p className="tarjeta-meta">
        Te avisamos cuando alguien te escriba o empiece a seguirte, aunque tengas MiLepe cerrada. El permiso es
        de este navegador: si entras desde el móvil y desde el ordenador, tendrás que activarlo en los dos.
      </p>

      {estado === 'no-soportado' && (
        <div className="aviso aviso-info">
          <Icono nombre="campana" tam={18} />
          <span>
            Este navegador no admite avisos. En iPhone hace falta añadir MiLepe a la pantalla de inicio primero.
          </span>
        </div>
      )}

      {estado === 'denegado' && (
        <div className="aviso aviso-aviso">
          <Icono nombre="alerta" tam={18} />
          <span>
            Has bloqueado los avisos para MiLepe. Solo se puede volver a permitir desde los ajustes del sitio en
            tu navegador: nosotros ya no podemos preguntártelo otra vez.
          </span>
        </div>
      )}

      {estado === 'activo' && (
        <>
          <div className="aviso aviso-exito">
            <Icono nombre="comprobado" tam={18} />
            <span>Los avisos están activados en este dispositivo.</span>
          </div>
          <button type="button" className="btn btn-contorno" onClick={desactivar} disabled={ocupado}>
            {ocupado ? 'Desactivando...' : 'Desactivar avisos aquí'}
          </button>
        </>
      )}

      {estado === 'inactivo' && (
        <button type="button" className="btn btn-primario" onClick={activar} disabled={ocupado}>
          <Icono nombre="campana" tam={16} />
          {ocupado ? 'Activando...' : 'Activar avisos'}
        </button>
      )}

      {error && <p className="mensaje-error">{error}</p>}
    </div>
  );
}

export default AvisosPush;
