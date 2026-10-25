import { useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import TarjetaPublicacion, { Dato } from '../../components/TarjetaPublicacion.jsx';
import Icono from '../../components/Icono.jsx';
import { fechaCorta } from '../../utils/fechas.js';

const ETIQUETA_CATEGORIA = {
  restauracion: 'Restauración',
  alojamiento: 'Alojamiento',
  comercio: 'Comercio',
  servicios: 'Servicios',
  ocio: 'Ocio',
  otros: 'Otros',
};

// datetime-local quiere "AAAA-MM-DDTHH:MM" en hora local.
const aLocal = (fecha) => {
  const d = new Date(fecha);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function EditarFicha({ negocio, onGuardado, onCancelar }) {
  const [datos, setDatos] = useState({
    direccion: negocio.direccion || '',
    telefono: negocio.telefono || '',
    horario: negocio.horario || '',
    sitio_web: negocio.sitio_web || '',
  });
  const [oferta, setOferta] = useState({
    texto: negocio.oferta?.texto || '',
    vigente_hasta: negocio.oferta ? aLocal(negocio.oferta.vigente_hasta) : '',
  });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (e) => setDatos({ ...datos, [e.target.name]: e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api.patch(`/negocios/${negocio._id}/ficha`, datos);
      const { data } = await api.put(`/negocios/${negocio._id}/oferta`, {
        texto: oferta.texto,
        vigente_hasta: oferta.vigente_hasta ? new Date(oferta.vigente_hasta).toISOString() : null,
      });
      onGuardado(data.negocio);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo guardar');
      setEnviando(false);
    }
  };

  return (
    <form className="formulario-edicion" onSubmit={guardar}>
      <label>
        Dirección
        <input name="direccion" required maxLength={200} value={datos.direccion} onChange={cambiar} />
      </label>
      <label>
        Teléfono
        <input name="telefono" type="tel" value={datos.telefono} onChange={cambiar} />
      </label>
      <label>
        Horario
        <input name="horario" value={datos.horario} onChange={cambiar} />
      </label>
      <label>
        Sitio web
        <input name="sitio_web" value={datos.sitio_web} onChange={cambiar} />
      </label>
      <label>
        Oferta (opcional; vacía para quitarla)
        <input maxLength={280} value={oferta.texto} onChange={(e) => setOferta({ ...oferta, texto: e.target.value })} />
      </label>
      {oferta.texto.trim() && (
        <label>
          La oferta vale hasta
          <input
            type="datetime-local"
            required
            value={oferta.vigente_hasta}
            onChange={(e) => setOferta({ ...oferta, vigente_hasta: e.target.value })}
          />
        </label>
      )}
      {error && <p className="mensaje-error">{error}</p>}
      <div className="acciones-formulario">
        <button type="submit" className="btn btn-primario btn-sm" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="btn btn-contorno btn-sm" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Reclamar({ negocio, onHecho, onCancelar }) {
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState(null);

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/negocios/${negocio._id}/reclamar`, { mensaje });
      onHecho();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo enviar');
    }
  };

  return (
    <form className="formulario-edicion" onSubmit={enviar}>
      <label>
        Cómo podemos comprobarlo: por ejemplo, llamaros al teléfono del local, que os escriba desde el correo de su web, o el CIF o la licencia a vuestro nombre
        <textarea rows={3} required maxLength={500} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
      </label>
      {error && <p className="mensaje-error">{error}</p>}
      <div className="acciones-formulario">
        <button type="submit" className="btn btn-primario btn-sm">
          Enviar
        </button>
        <button type="button" className="btn btn-contorno btn-sm" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function NegocioTarjeta({ negocio: inicial, reclamacionPendiente = false, onReclamado }) {
  const { usuario } = useAuth();
  const [negocio, setNegocio] = useState(inicial);
  const [modo, setModo] = useState(null); // null | 'editar' | 'reclamar' | 'reclamado'

  const autorId = negocio.autor?._id || negocio.autor_id;
  const propietario = negocio.propietario_id ? String(negocio.propietario_id) : null;
  const yo = usuario ? String(usuario._id) : null;
  const gestiono = Boolean(yo && (usuario.rol === 'admin' || (propietario ? propietario === yo : String(autorId) === yo)));
  const puedoReclamar = Boolean(yo && !gestiono && propietario !== yo);
  // Quien lo publicó lo gestiona mientras no tenga propietario, pero eso no
  // es lo mismo que serlo: puede acreditarlo para que lleve la etiqueta.
  const puedoAcreditar = Boolean(yo && !propietario && String(autorId) === yo);

  return (
    <TarjetaPublicacion
      post={negocio}
      propietarioId={propietario}
      // Las reseñas de un negocio son comentarios con valoracion: es la
      // unica seccion que enciende el selector de estrellas.
      permitirValoracion
      chips={
        <>
          <span className="insignia">{ETIQUETA_CATEGORIA[negocio.categoria] || negocio.categoria}</span>
          {negocio.destacado && <span className="insignia insignia-destacado"><Icono nombre="estrella" tam={12} /> Destacado</span>}
          {propietario && <span className="insignia insignia-marca">Gestionado por su propietario</span>}
        </>
      }
      datos={
        <>
          <Dato icono="ubicacion">{negocio.direccion}</Dato>
          <Dato icono="reloj">{negocio.horario}</Dato>
          {typeof negocio.distancia_metros === 'number' && (
            <Dato icono="ubicacion">A {(negocio.distancia_metros / 1000).toFixed(1)} km de ti</Dato>
          )}
        </>
      }
      acciones={
        <>
          {negocio.telefono && (
            <a className="accion" href={`tel:${negocio.telefono.replace(/[^\d+]/g, '')}`}>
              <Icono nombre="telefono" tam={18} />
              {negocio.telefono}
            </a>
          )}
          {negocio.sitio_web && (
            <a className="accion" href={negocio.sitio_web} target="_blank" rel="noreferrer">
              <Icono nombre="enlace" tam={18} />
              Sitio web
            </a>
          )}
        </>
      }
    >
      {negocio.oferta && (
        <div className="respuesta-queja">
          <strong>Oferta</strong>
          <p>{negocio.oferta.texto}</p>
          <span className="tarjeta-meta">Hasta el {fechaCorta(negocio.oferta.vigente_hasta)}</span>
        </div>
      )}

      {modo === 'editar' && (
        <EditarFicha
          negocio={negocio}
          onCancelar={() => setModo(null)}
          onGuardado={(actualizado) => {
            setNegocio({ ...negocio, ...actualizado });
            setModo(null);
          }}
        />
      )}
      {modo === 'reclamar' && (
        <Reclamar
          negocio={negocio}
          onCancelar={() => setModo(null)}
          onHecho={() => {
            setModo('reclamado');
            onReclamado?.();
          }}
        />
      )}
      {!modo && reclamacionPendiente && !propietario && (
        <p className="tarjeta-meta">Has pedido gestionar este negocio como propietario: está pendiente de que un administrador lo compruebe.</p>
      )}
      {modo === 'reclamado' && (
        <p className="tarjeta-meta">Recibido. Un administrador lo revisará y te avisaremos.</p>
      )}

      {!modo && gestiono && (
        <button type="button" className="btn btn-contorno btn-sm" onClick={() => setModo('editar')}>
          Editar ficha y oferta
        </button>
      )}
      {!modo && puedoAcreditar && !reclamacionPendiente && (
        <button type="button" className="btn btn-plano btn-sm" onClick={() => setModo('reclamar')}>
          Acreditar que soy el propietario
        </button>
      )}
      {!modo && puedoReclamar && !reclamacionPendiente && (
        <button type="button" className="btn btn-plano btn-sm" onClick={() => setModo('reclamar')}>
          ¿Es tu negocio? Gestiónalo
        </button>
      )}
    </TarjetaPublicacion>
  );
}

export default NegocioTarjeta;
