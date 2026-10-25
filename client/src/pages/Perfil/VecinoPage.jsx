import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSeguimientos } from '../../context/SeguimientosContext.jsx';
import Avatar from '../../components/Avatar.jsx';
import Icono from '../../components/Icono.jsx';
import BotonSeguir from '../../components/BotonSeguir.jsx';
import InsigniaOficial from '../../components/InsigniaOficial.jsx';
import TarjetaPublicacion from '../../components/TarjetaPublicacion.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import { Linea } from '../../components/Esqueleto.jsx';
import { SECCION_POR_TIPO } from '../../router/secciones.js';
import { fechaCorta } from '../../utils/fechas.js';
import { useTitulo } from '../../hooks/useTitulo.js';
import SuspensionAdmin from './SuspensionAdmin.jsx';
import InsigniaVerificado from '../../components/InsigniaVerificado.jsx';

// La ficha pública de un vecino: lo que ve el resto del pueblo.
//
// Se lee sin cuenta, como todo lo demás de MiLepe. Lo que cambia con
// sesión son los dos botones: seguirle y escribirle.
function VecinoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { relacionCon } = useSeguimientos();

  const [ficha, setFicha] = useState(null);
  useTitulo(ficha?.usuario?.nombre_usuario);
  const [publicaciones, setPublicaciones] = useState(null);
  const [error, setError] = useState(null);
  const [abriendo, setAbriendo] = useState(false);
  const [avisoMensaje, setAvisoMensaje] = useState(null);

  useEffect(() => {
    let cancelado = false;

    setFicha(null);
    setPublicaciones(null);
    setError(null);

    api
      .get(`/usuarios/${id}`)
      .then(({ data }) => {
        if (!cancelado) setFicha(data);
      })
      .catch((err) => {
        if (!cancelado) {
          setError(err.response?.status === 404 ? 'Este vecino no existe.' : 'No se pudo cargar la ficha.');
        }
      });

    api
      .get('/posts', { params: { autor: id, limite: 20 } })
      .then(({ data }) => {
        if (!cancelado) setPublicaciones(data.posts);
      })
      .catch(() => {
        if (!cancelado) setPublicaciones([]);
      });

    return () => {
      cancelado = true;
    };
  }, [id]);

  const escribir = async () => {
    setAbriendo(true);
    setAvisoMensaje(null);

    try {
      const { data } = await api.post(`/conversaciones/con/${id}`);
      navigate(`/mensajes/${data.conversacion._id}`);
    } catch (err) {
      setAvisoMensaje(err.response?.data?.mensaje || 'No se pudo abrir la conversación.');
      setAbriendo(false);
    }
  };

  if (error) return <p className="mensaje-error">{error}</p>;

  if (!ficha) {
    return (
      <div className="tarjeta">
        <Linea ancho="40%" alto={20} />
        <Linea ancho="70%" />
      </div>
    );
  }

  const esMiFicha = String(ficha.usuario._id) === String(usuario?._id);
  // La relación se pide con la ficha, pero se lee del contexto para que
  // pulsar "seguir" cambie el botón de escribir en el mismo instante, sin
  // recargar la página.
  const relacion = usuario && !esMiFicha ? relacionCon(ficha.usuario._id) : null;
  const puedeEscribir = Boolean(relacion?.mutuo) && !ficha.relacion?.bloqueado;

  return (
    <>
      <div className="tarjeta perfil-publico">
        <Avatar usuario={ficha.usuario} tamano="lg" />

        <div>
          <div className="pub-nombre" style={{ fontSize: 'var(--t-lg)' }}>
            {ficha.usuario.nombre_usuario} <InsigniaVerificado usuario={ficha.usuario} conTexto />{' '}
            {ficha.usuario.oficial && <InsigniaOficial conTexto />}
          </div>
          <p className="tarjeta-meta">
            Vecino desde {fechaCorta(ficha.usuario.fecha_creacion)}
            {usuario?.rol === 'admin' && (
              <>
                {' · '}
                <button
                  type="button"
                  className="btn btn-plano btn-sm"
                  onClick={async () => {
                    const { data } = await api.patch(`/usuarios/${ficha.usuario._id}/oficial`, {
                      oficial: !ficha.usuario.oficial,
                    });
                    setFicha({ ...ficha, usuario: { ...ficha.usuario, oficial: data.usuario.oficial } });
                  }}
                >
                  {ficha.usuario.oficial ? 'Quitar cuenta oficial' : 'Marcar como cuenta oficial'}
                </button>
                {/* Verificación sin pagar. A un admin no se le quita (lo está siempre). */}
                {!(ficha.usuario.rol === 'admin' && ficha.usuario.verificado_manual) && (
                  <button
                    type="button"
                    className="btn btn-plano btn-sm"
                    onClick={async () => {
                      const { data } = await api.patch(`/usuarios/${ficha.usuario._id}/verificado`, {
                        verificado: !ficha.usuario.verificado_manual,
                      });
                      setFicha({ ...ficha, usuario: { ...ficha.usuario, verificado_manual: data.usuario.verificado_manual } });
                    }}
                  >
                    {ficha.usuario.verificado_manual ? 'Quitar verificación' : 'Verificar sin pago'}
                  </button>
                )}
                {ficha.usuario.rol !== 'admin' && String(ficha.usuario._id) !== String(usuario._id) && (
                  <button
                    type="button"
                    className="btn btn-plano btn-sm"
                    onClick={async () => {
                      const { data } = await api.patch(`/usuarios/${ficha.usuario._id}/rol`, {
                        rol: ficha.usuario.rol === 'moderador' ? 'usuario' : 'moderador',
                      });
                      setFicha({ ...ficha, usuario: { ...ficha.usuario, rol: data.usuario.rol } });
                    }}
                  >
                    {ficha.usuario.rol === 'moderador' ? 'Quitar de moderación' : 'Nombrar moderador'}
                  </button>
                )}
              </>
            )}
            {ficha.usuario.rol !== 'usuario' && (
              <>
                {' · '}
                <span className="insignia insignia-marca">{ficha.usuario.rol}</span>
              </>
            )}
          </p>

          {usuario?.rol === 'admin' && ficha.usuario.rol !== 'admin' && String(ficha.usuario._id) !== String(usuario._id) && (
            <SuspensionAdmin
              usuario={ficha.usuario}
              onCambio={(suspension) => setFicha({ ...ficha, usuario: { ...ficha.usuario, suspension } })}
            />
          )}

          <p className="tarjeta-meta">
            <strong>{ficha.contadores.seguidores}</strong> seguidores ·{' '}
            <strong>{ficha.contadores.siguiendo}</strong> siguiendo ·{' '}
            <strong>{ficha.contadores.publicaciones}</strong> publicaciones
          </p>
        </div>

        {esMiFicha ? (
          <Link to="/perfil" className="btn btn-contorno empuja">
            Editar mi perfil
          </Link>
        ) : (
          <div className="perfil-acciones empuja">
            <BotonSeguir usuarioId={ficha.usuario._id} />

            {usuario && (
              <button
                type="button"
                className="btn btn-contorno"
                onClick={escribir}
                disabled={!puedeEscribir || abriendo}
                // El motivo va en el title y, si se pulsa, también a la
                // vista: un botón apagado sin explicación es lo que hace
                // que la gente piense que la aplicación está rota.
                title={
                  puedeEscribir
                    ? 'Escribir un mensaje privado'
                    : 'Os tenéis que seguir mutuamente para poder escribiros'
                }
              >
                <Icono nombre="mensajes" tam={16} />
                {abriendo ? 'Abriendo...' : 'Mensaje'}
              </button>
            )}
          </div>
        )}
      </div>

      {!esMiFicha && usuario && !puedeEscribir && (
        <div className="aviso aviso-info">
          <Icono nombre="mensajes" tam={18} />
          <span>
            {ficha.relacion?.bloqueado
              ? 'No podéis escribiros porque hay un bloqueo entre vosotros.'
              : relacion?.sigo
                ? `Ya sigues a ${ficha.usuario.nombre_usuario}. Podréis escribiros cuando te siga de vuelta.`
                : 'Os tenéis que seguir mutuamente para poder escribiros.'}
          </span>
        </div>
      )}

      {avisoMensaje && <p className="mensaje-error">{avisoMensaje}</p>}

      <div className="cabecera-pagina">
        <div className="cabecera-pagina-texto">
          <h2>Publicaciones</h2>
        </div>
      </div>

      {publicaciones === null && (
        <div className="tarjeta">
          <Linea ancho="60%" />
          <Linea ancho="90%" />
        </div>
      )}

      {publicaciones?.length === 0 && (
        <EstadoVacio icono="muro" titulo="Todavía no ha publicado nada">
          Cuando {ficha.usuario.nombre_usuario} publique algo, aparecerá aquí.
        </EstadoVacio>
      )}

      {publicaciones?.map((post) => (
        <TarjetaPublicacion key={post._id} post={post} seccion={SECCION_POR_TIPO[post.tipo]} />
      ))}
    </>
  );
}

export default VecinoPage;
