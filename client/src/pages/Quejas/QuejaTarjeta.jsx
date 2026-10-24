import { useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import TarjetaPublicacion, { Dato } from '../../components/TarjetaPublicacion.jsx';
import InsigniaOficial from '../../components/InsigniaOficial.jsx';
import { fechaHora } from '../../utils/fechas.js';

// El estado de una queja es su dato mas importante: es lo que distingue
// "ya lo hemos dicho" de "esta en marcha". Por eso va con color y no como
// una insignia gris mas.
const ESTADOS = {
  pendiente: { etiqueta: 'Pendiente', clase: 'insignia-aviso' },
  en_curso: { etiqueta: 'En curso', clase: 'insignia-info' },
  resuelto: { etiqueta: 'Resuelto', clase: 'insignia-exito' },
};

// Mismo enum que server/src/models/QuejaDetalle.js (CATEGORIAS_QUEJA). Antes
// esta lista era otra (alumbrado, ruido...) y las quejas reales salian con
// la clave en crudo.
const ETIQUETA_CATEGORIA = {
  limpieza: 'Limpieza',
  suministros: 'Suministros',
  obras: 'Obras',
  jardineria: 'Jardinería',
  general: 'General',
};

const quienResponde = (entrada) => (entrada.oficial ? 'Ayuntamiento' : 'Equipo de MiLepe');

// Cambiar el estado y/o responder. Solo lo ven el Ayuntamiento y el equipo;
// la API lo vuelve a comprobar.
function Tramitar({ queja, onHecho, onCancelar }) {
  const [estado, setEstado] = useState(queja.estado);
  const [nota, setNota] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const { data } = await api.patch(`/quejas/${queja._id}/estado`, { estado, nota });
      onHecho(data);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo guardar');
      setEnviando(false);
    }
  };

  return (
    <form className="formulario-edicion" onSubmit={enviar}>
      <label>
        Estado
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          {Object.entries(ESTADOS).map(([valor, { etiqueta }]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label>
        Respuesta pública (opcional)
        <textarea rows={3} maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} />
      </label>
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

function QuejaTarjeta({ queja: inicial }) {
  const { usuario } = useAuth();
  const esGestor = Boolean(usuario?.oficial || usuario?.rol === 'moderador' || usuario?.rol === 'admin');

  const [queja, setQueja] = useState(inicial);
  const [tramitando, setTramitando] = useState(false);
  const [verSeguimiento, setVerSeguimiento] = useState(false);

  const estado = ESTADOS[queja.estado] || { etiqueta: queja.estado, clase: '' };
  const historial = queja.historial_estados || [];
  const respuesta = [...historial].reverse().find((h) => h.nota);

  return (
    <TarjetaPublicacion
      post={queja}
      chips={
        <>
          <span className={`insignia ${estado.clase}`}>{estado.etiqueta}</span>
          <span className="insignia">{ETIQUETA_CATEGORIA[queja.categoria] || queja.categoria}</span>
        </>
      }
      datos={<Dato icono="ubicacion">{queja.direccion_aproximada}</Dato>}
    >
      {respuesta && (
        <div className="respuesta-queja">
          <strong>
            Respuesta del {quienResponde(respuesta)} {respuesta.oficial && <InsigniaOficial />}
          </strong>
          <p>{respuesta.nota}</p>
          <span className="tarjeta-meta">{fechaHora(respuesta.fecha)}</span>
        </div>
      )}

      {historial.length > 0 && (
        <button type="button" className="btn btn-plano btn-sm" onClick={() => setVerSeguimiento(!verSeguimiento)}>
          {verSeguimiento ? 'Ocultar seguimiento' : `Ver seguimiento (${historial.length})`}
        </button>
      )}
      {verSeguimiento && (
        <ol className="seguimiento-queja">
          {historial.map((h, i) => (
            <li key={`${h.fecha}-${i}`}>
              <span className={`insignia ${ESTADOS[h.estado]?.clase || ''}`}>{ESTADOS[h.estado]?.etiqueta || h.estado}</span>{' '}
              <span className="tarjeta-meta">
                {fechaHora(h.fecha)} · {quienResponde(h)}
              </span>
              {h.nota && <div>{h.nota}</div>}
            </li>
          ))}
        </ol>
      )}

      {esGestor &&
        (tramitando ? (
          <Tramitar
            queja={queja}
            onCancelar={() => setTramitando(false)}
            onHecho={(datos) => {
              setQueja({ ...queja, ...datos });
              setTramitando(false);
            }}
          />
        ) : (
          <button type="button" className="btn btn-contorno btn-sm" onClick={() => setTramitando(true)}>
            Tramitar o responder
          </button>
        ))}
    </TarjetaPublicacion>
  );
}

export default QuejaTarjeta;
