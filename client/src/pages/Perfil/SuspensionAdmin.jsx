import { useState } from 'react';
import api from '../../services/api.js';

const fecha = (iso) => new Date(iso).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });

const estaVigente = (s) => Boolean(s?.permanente || (s?.hasta && new Date(s.hasta) > new Date()));

// Suspender o levantar la suspensión de una cuenta, desde su ficha. Solo lo
// pinta VecinoPage para un admin, y la API lo vuelve a comprobar. El motivo
// es obligatorio: se le enseña a la persona al intentar entrar y le llega
// por correo.
function SuspensionAdmin({ usuario, onCambio }) {
  const [abierto, setAbierto] = useState(false);
  const [duracion, setDuracion] = useState('7');
  const [motivo, setMotivo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  const suspension = usuario.suspension;
  const vigente = estaVigente(suspension);

  const suspender = async (e) => {
    e.preventDefault();
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setError(null);
    setOcupado(true);
    try {
      const cuerpo = duracion === 'permanente' ? { motivo, permanente: true } : { motivo, dias: Number(duracion) };
      const { data } = await api.put(`/usuarios/${usuario._id}/suspension`, cuerpo);
      onCambio(data.suspension);
      setAbierto(false);
      setConfirmando(false);
      setMotivo('');
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo suspender la cuenta.');
      setConfirmando(false);
    } finally {
      setOcupado(false);
    }
  };

  const levantar = async () => {
    setError(null);
    setOcupado(true);
    try {
      const { data } = await api.delete(`/usuarios/${usuario._id}/suspension`);
      onCambio(data.suspension);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo levantar la suspensión.');
    } finally {
      setOcupado(false);
    }
  };

  if (vigente) {
    return (
      <div className="aviso aviso-error" style={{ display: 'grid', gap: 'var(--e-2)' }}>
        <strong>
          Cuenta suspendida {suspension.permanente ? 'de forma indefinida' : `hasta el ${fecha(suspension.hasta)}`}
        </strong>
        <span>Motivo: {suspension.motivo}</span>
        <div>
          <button type="button" className="btn btn-contorno btn-sm" disabled={ocupado} onClick={levantar}>
            Levantar la suspensión
          </button>
        </div>
        {error && <p className="mensaje-error">{error}</p>}
      </div>
    );
  }

  if (!abierto) {
    return (
      <button type="button" className="btn btn-plano btn-sm" onClick={() => setAbierto(true)}>
        Suspender la cuenta
      </button>
    );
  }

  return (
    <form className="tarjeta" onSubmit={suspender}>
      <h2>Suspender a {usuario.nombre_usuario}</h2>

      <label htmlFor="suspension-duracion">Durante</label>
      <select
        id="suspension-duracion"
        value={duracion}
        onChange={(e) => {
          setDuracion(e.target.value);
          setConfirmando(false);
        }}
      >
        <option value="1">1 día</option>
        <option value="7">7 días</option>
        <option value="30">30 días</option>
        <option value="90">90 días</option>
        <option value="permanente">Indefinidamente (hasta que se levante)</option>
      </select>

      <label htmlFor="suspension-motivo">Motivo (lo verá la persona)</label>
      <textarea
        id="suspension-motivo"
        rows={2}
        required
        maxLength={500}
        value={motivo}
        onChange={(e) => {
          setMotivo(e.target.value);
          setConfirmando(false);
        }}
      />

      <p className="tarjeta-meta">
        No podrá entrar ni publicar mientras dure; lo que ya publicó se queda como está. Se le avisa por correo y queda en el
        registro de moderación. Si borra la cuenta, no podrá volver a registrarse con ese correo hasta que acabe.
      </p>

      {error && <p className="mensaje-error">{error}</p>}
      <div className="fila" style={{ gap: 'var(--e-2)' }}>
        <button type="submit" className={confirmando ? 'btn btn-peligro' : undefined} disabled={ocupado || !motivo.trim()}>
          {confirmando ? 'Sí, suspender' : 'Suspender'}
        </button>
        <button
          type="button"
          className="btn btn-contorno"
          onClick={() => {
            setAbierto(false);
            setConfirmando(false);
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default SuspensionAdmin;
