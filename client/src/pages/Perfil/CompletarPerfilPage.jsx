import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import FormularioPerfil from './FormularioPerfil.jsx';
import AvisoVerificacion from './AvisoVerificacion.jsx';
import { Linea } from '../../components/Esqueleto.jsx';

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

  useEffect(() => {
    let cancelado = false;

    api.get('/usuarios/perfil').then(({ data }) => {
      if (!cancelado) setPerfil(data.usuario);
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

      {!perfil ? (
        <Linea ancho="100%" alto={30} />
      ) : (
        <FormularioPerfil perfil={perfil} onGuardado={alGuardar} textoBoton="Guardar y empezar" />
      )}
    </section>
  );
}

export default CompletarPerfilPage;
