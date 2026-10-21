import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import FormularioPerfil from './FormularioPerfil.jsx';
import AvisoVerificacion from './AvisoVerificacion.jsx';
import Avatar from '../../components/Avatar.jsx';
import Icono from '../../components/Icono.jsx';
import { Linea } from '../../components/Esqueleto.jsx';
import { fechaCorta } from '../../utils/fechas.js';

// Mi perfil: arriba lo que ven los demás, debajo el formulario para
// editarlo.
//
// El nombre y los apellidos reales solo viajan en esta petición concreta
// (GET /usuarios/perfil), no en la sesión guardada en localStorage, así que
// hay que pedirlos aquí aunque ya haya un usuario en el contexto.
function PerfilPage() {
  const { usuario, refrescarUsuario } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [error, setError] = useState(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    let cancelado = false;

    api
      .get('/usuarios/perfil')
      .then(({ data }) => {
        if (!cancelado) setPerfil(data.usuario);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo cargar tu perfil.');
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const alGuardar = (actualizado) => {
    setPerfil(actualizado);
    refrescarUsuario(actualizado);
    setGuardado(true);
  };

  if (error) return <p className="mensaje-error">{error}</p>;

  return (
    <>
      <div className="cabecera-pagina">
        <div className="cabecera-pagina-texto">
          <h1>Mi perfil</h1>
          <p className="cabecera-pagina-sub">Así te ven el resto de vecinos de Lepe</p>
        </div>
      </div>

      {!usuario?.email_verificado && <AvisoVerificacion />}

      {!perfil ? (
        <div className="tarjeta">
          <Linea ancho="40%" alto={20} />
          <Linea ancho="70%" />
        </div>
      ) : (
        <>
          {/* Exactamente lo que ve otro vecino, ni más ni menos. Enseñarlo
              así ahorra tener que explicar con palabras que el nombre real
              no aparece por ningún lado. */}
          <div className="tarjeta perfil-publico">
            <Avatar usuario={perfil} tamano="lg" />
            <div>
              <div className="pub-nombre" style={{ fontSize: 'var(--t-lg)' }}>
                {perfil.nombre_usuario}
              </div>
              <p className="tarjeta-meta">
                Vecino desde {fechaCorta(perfil.fecha_creacion)}
                {perfil.rol !== 'usuario' && (
                  <>
                    {' · '}
                    <span className="insignia insignia-marca">{perfil.rol}</span>
                  </>
                )}
              </p>
            </div>
            <span className={`insignia empuja ${perfil.email_verificado ? 'insignia-exito' : 'insignia-aviso'}`}>
              <Icono nombre={perfil.email_verificado ? 'comprobado' : 'alerta'} tam={14} />
              {perfil.email_verificado ? 'Correo verificado' : 'Sin verificar'}
            </span>
          </div>

          <div className="tarjeta-formulario">
            <h2>Editar perfil</h2>

            {guardado && (
              <div className="aviso aviso-exito">
                <Icono nombre="comprobado" tam={18} />
                <span>Perfil guardado.</span>
              </div>
            )}

            <FormularioPerfil perfil={perfil} onGuardado={alGuardar} textoBoton="Guardar cambios" />
          </div>

          <p className="tarjeta-meta" style={{ marginTop: 'var(--e-4)' }}>
            Tu correo es <strong>{perfil.email}</strong>. Tampoco es público.
          </p>
        </>
      )}
    </>
  );
}

export default PerfilPage;
