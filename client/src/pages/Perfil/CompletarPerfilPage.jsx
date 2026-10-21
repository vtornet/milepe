import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import FormularioPerfil from './FormularioPerfil.jsx';
import AvisoVerificacion from './AvisoVerificacion.jsx';
import { Linea } from '../../components/Esqueleto.jsx';
import Icono from '../../components/Icono.jsx';

// Pantalla de alta. Aquí llega todo el que entra con el perfil sin
// terminar (ver GuardiaPerfil): tanto quien se acaba de registrar como
// quien entró con Google, que nunca eligió nombre de usuario porque se le
// inventó uno a partir del correo.
//
// Se puede mirar MiLepe sin pasar por aquí; lo que no se puede es publicar.
// Esa diferencia se dice explícitamente: una pantalla obligatoria nada más
// entrar, sin explicar por qué, es de lo que más hace que la gente se vaya.
function CompletarPerfilPage() {
  const { refrescarUsuario } = useAuth();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    api
      .get('/usuarios/perfil')
      .then(({ data }) => {
        if (!cancelado) setPerfil(data.usuario);
      })
      // Sin esto, un fallo al cargar dejaba en pantalla la barra gris del
      // esqueleto para siempre: ni formulario, ni explicacion, ni salida.
      // Un cargador que no termina nunca es peor que un error, porque
      // quien lo mira no sabe si esperar o irse.
      .catch(() => {
        if (!cancelado) setError('No hemos podido cargar tus datos. Vuelve a intentarlo en un momento.');
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const alGuardar = (actualizado) => {
    refrescarUsuario(actualizado);
    navigate('/', { replace: true });
  };

  return (
    <section className="formulario-auth" style={{ maxWidth: 520 }}>
      <img className="marca-auth" src="/icons/marca.png" alt="MiLepe" width={56} height={56} />
      <h1>Ya casi estás</h1>
      <p className="formulario-auth-sub">
        Completa tu perfil para poder publicar, comentar y escribir a otros vecinos. Mirar MiLepe puedes hacerlo
        desde ya.
      </p>

      <AvisoVerificacion />

      {error ? (
        <>
          <div className="aviso aviso-error">
            <Icono nombre="alerta" tam={18} />
            <span>{error}</span>
          </div>
          <div className="formulario-reporte-acciones">
            <button type="button" className="btn btn-primario" onClick={() => window.location.reload()}>
              Reintentar
            </button>
            <Link to="/" className="btn btn-contorno">
              Volver al muro
            </Link>
          </div>
        </>
      ) : !perfil ? (
        <>
          <Linea ancho="100%" alto={30} />
          <p className="tarjeta-meta centrado" style={{ marginTop: 'var(--e-3)' }}>
            Cargando tus datos...
          </p>
        </>
      ) : (
        <FormularioPerfil perfil={perfil} onGuardado={alGuardar} textoBoton="Guardar y empezar" />
      )}
    </section>
  );
}

export default CompletarPerfilPage;
