import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Avatar from '../../components/Avatar.jsx';
import { EsqueletoLista } from '../../components/Esqueleto.jsx';
import SuspensionAdmin from '../Perfil/SuspensionAdmin.jsx';

const fecha = (iso) => new Date(iso).toLocaleDateString('es-ES', { dateStyle: 'medium' });

const ROLES = [
  { valor: 'usuario', texto: 'Vecino' },
  { valor: 'moderador', texto: 'Moderador' },
  { valor: 'admin', texto: 'Administrador' },
];

const ESTADOS = [
  { valor: '', texto: 'Todas las cuentas' },
  { valor: 'suspendidos', texto: 'Suspendidas' },
  { valor: 'oficiales', texto: 'Cuenta oficial' },
  { valor: 'verificados', texto: 'Verificadas' },
  { valor: 'sin_verificar_correo', texto: 'Correo sin verificar' },
  { valor: 'inactivos', texto: 'Borradas / desactivadas' },
];

// Un vecino con sus datos privados y los controles para administrarlo. Los
// datos reales (nombre, apellidos, correo) solo viajan en esta lista, que
// es de admin; cada acción llama al mismo endpoint que la ficha pública.
function FilaUsuario({ fila, esYo, onCambio }) {
  const [abierta, setAbierta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  // Cambiar el rol (sobre todo a admin) pide confirmación en línea.
  const [rolPendiente, setRolPendiente] = useState(null);

  const ejecutar = async (peticion) => {
    setError(null);
    setOcupado(true);
    try {
      await peticion();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo hacer el cambio.');
    } finally {
      setOcupado(false);
    }
  };

  const cambiarRol = (rol) =>
    ejecutar(async () => {
      const { data } = await api.patch(`/usuarios/${fila._id}/rol`, { rol });
      onCambio(fila._id, { rol: data.usuario.rol, ...(data.usuario.rol === 'admin' ? { verificado_manual: true } : {}) });
      setRolPendiente(null);
    });

  const alternarOficial = () =>
    ejecutar(async () => {
      const { data } = await api.patch(`/usuarios/${fila._id}/oficial`, { oficial: !fila.oficial });
      onCambio(fila._id, { oficial: data.usuario.oficial });
    });

  const alternarVerificado = () =>
    ejecutar(async () => {
      const { data } = await api.patch(`/usuarios/${fila._id}/verificado`, { verificado: !fila.verificado_manual });
      onCambio(fila._id, { verificado_manual: data.usuario.verificado_manual });
    });

  const nombreReal = [fila.nombre, fila.apellidos].filter(Boolean).join(' ');
  const gestionable = fila.activo && !esYo;

  return (
    <article className="tarjeta">
      <div className="fila" style={{ gap: 'var(--e-3)', alignItems: 'center' }}>
        <Avatar usuario={fila} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong>
            <Link to={`/vecino/${fila._id}`}>{fila.nombre_usuario}</Link>
          </strong>{' '}
          {fila.rol !== 'usuario' && <span className="insignia insignia-marca">{fila.rol}</span>}{' '}
          {fila.oficial && <span className="insignia insignia-info">oficial</span>}{' '}
          {fila.verificado_manual && <span className="insignia insignia-exito">verificado</span>}{' '}
          {fila.suspendido && <span className="insignia insignia-peligro">suspendida</span>}{' '}
          {!fila.activo && <span className="insignia">borrada</span>}
          <p className="tarjeta-meta" style={{ overflowWrap: 'anywhere' }}>
            {nombreReal || 'Sin nombre'} · {fila.email}
          </p>
          <p className="tarjeta-meta">
            Alta {fecha(fila.fecha_creacion)}
            {fila.con_google ? ' · Google' : ''}
            {!fila.email_verificado ? ' · correo sin verificar' : ''}
            {!fila.perfil_completo ? ' · perfil incompleto' : ''}
          </p>
        </div>
        {gestionable && (
          <button type="button" className="btn btn-contorno btn-sm" onClick={() => setAbierta((v) => !v)}>
            {abierta ? 'Cerrar' : 'Gestionar'}
          </button>
        )}
      </div>

      {abierta && gestionable && (
        <div style={{ display: 'grid', gap: 'var(--e-3)', marginTop: 'var(--e-3)' }}>
          <div className="fila" style={{ gap: 'var(--e-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <label htmlFor={`rol-${fila._id}`}>Rol</label>
            <select
              id={`rol-${fila._id}`}
              style={{ width: 'auto' }}
              value={rolPendiente ?? fila.rol}
              disabled={ocupado}
              onChange={(e) => setRolPendiente(e.target.value === fila.rol ? null : e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.texto}
                </option>
              ))}
            </select>
            {rolPendiente && (
              <>
                <button
                  type="button"
                  className={rolPendiente === 'admin' || fila.rol === 'admin' ? 'btn btn-peligro btn-sm' : 'btn btn-sm'}
                  disabled={ocupado}
                  onClick={() => cambiarRol(rolPendiente)}
                >
                  {rolPendiente === 'admin' ? '¿Seguro? Dar acceso total' : fila.rol === 'admin' ? '¿Seguro? Quitar administración' : 'Aplicar'}
                </button>
                <button type="button" className="btn btn-plano btn-sm" onClick={() => setRolPendiente(null)}>
                  Cancelar
                </button>
              </>
            )}
          </div>

          <div className="fila" style={{ gap: 'var(--e-2)', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-contorno btn-sm" disabled={ocupado} onClick={alternarOficial}>
              {fila.oficial ? 'Quitar cuenta oficial (Ayuntamiento)' : 'Marcar como cuenta oficial (Ayuntamiento)'}
            </button>
            {!(fila.rol === 'admin' && fila.verificado_manual) && (
              <button type="button" className="btn btn-contorno btn-sm" disabled={ocupado} onClick={alternarVerificado}>
                {fila.verificado_manual ? 'Quitar verificación' : 'Verificar sin pago'}
              </button>
            )}
          </div>

          {fila.rol !== 'admin' && (
            <SuspensionAdmin usuario={fila} onCambio={(suspension) => onCambio(fila._id, suspensionAFila(suspension))} />
          )}
          {error && <p className="mensaje-error">{error}</p>}
        </div>
      )}
    </article>
  );
}

const suspensionAFila = (suspension) => ({
  suspension,
  suspendido: Boolean(suspension?.permanente || (suspension?.hasta && new Date(suspension.hasta) > new Date())),
});

// Panel de usuarios (solo admin): todos los vecinos con sus datos y las
// acciones de administración en el mismo sitio. "Banear" = suspender
// (temporal o indefinida): no pueden entrar ni publicar y se les avisa.
function UsuariosPanel() {
  const { usuario } = useAuth();
  const [q, setQ] = useState('');
  const [consulta, setConsulta] = useState('');
  const [rol, setRol] = useState('');
  const [estado, setEstado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  // La búsqueda espera a que se deje de teclear: una petición por letra
  // sobre datos privados no tiene sentido.
  useEffect(() => {
    const t = setTimeout(() => {
      setConsulta(q.trim());
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const cargar = useCallback(async () => {
    const { data } = await api.get('/usuarios/admin', {
      params: { q: consulta || undefined, rol: rol || undefined, estado: estado || undefined, pagina, limite: 25 },
    });
    setDatos(data);
  }, [consulta, rol, estado, pagina]);

  useEffect(() => {
    let cancelado = false;
    setError(null);
    cargar().catch((err) => {
      if (!cancelado) setError(err.response?.data?.mensaje || 'No se pudo cargar la lista de usuarios.');
    });
    return () => {
      cancelado = true;
    };
  }, [cargar]);

  const aplicarCambio = (id, cambios) =>
    setDatos((d) => d && { ...d, usuarios: d.usuarios.map((u) => (u._id === id ? { ...u, ...cambios } : u)) });

  return (
    <section>
      <div className="lista-filtros">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por usuario, nombre o correo"
          aria-label="Buscar usuarios"
          style={{ flex: 1, minWidth: 200 }}
        />
        <select value={rol} onChange={(e) => (setRol(e.target.value), setPagina(1))} aria-label="Rol" style={{ width: 'auto' }}>
          <option value="">Todos los roles</option>
          {ROLES.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.texto}
            </option>
          ))}
        </select>
        <select
          value={estado}
          onChange={(e) => (setEstado(e.target.value), setPagina(1))}
          aria-label="Estado"
          style={{ width: 'auto' }}
        >
          {ESTADOS.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.texto}
            </option>
          ))}
        </select>
      </div>

      <p className="tarjeta-meta">
        Datos personales: no los compartas ni los copies fuera de MiLepe. Suspender = banear (temporal o indefinido).
      </p>

      {error && <p className="mensaje-error">{error}</p>}
      {!datos && !error && <EsqueletoLista />}
      {datos && (
        <>
          <p className="tarjeta-meta">
            {datos.total} cuenta(s) · página {datos.pagina} de {datos.paginas}
          </p>
          {datos.usuarios.length === 0 && <p>No hay cuentas con ese filtro.</p>}
          {datos.usuarios.map((fila) => (
            <FilaUsuario key={fila._id} fila={fila} esYo={String(fila._id) === String(usuario?._id)} onCambio={aplicarCambio} />
          ))}
          {datos.paginas > 1 && (
            <div className="fila" style={{ gap: 'var(--e-2)' }}>
              <button type="button" className="btn btn-contorno btn-sm" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
                Anterior
              </button>
              <button
                type="button"
                className="btn btn-contorno btn-sm"
                disabled={pagina >= datos.paginas}
                onClick={() => setPagina(pagina + 1)}
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default UsuariosPanel;
