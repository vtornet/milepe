import { useState } from 'react';
import api from '../../services/api.js';

const datosDe = (contacto) => ({
  nombre: contacto?.nombre || '',
  categoria: contacto?.categoria || 'otro',
  telefono: contacto?.telefono || '',
  telefono_alternativo: contacto?.telefono_alternativo || '',
  whatsapp: contacto?.whatsapp || '',
  email: contacto?.email || '',
  direccion: contacto?.direccion || '',
  horario: contacto?.horario || '',
  notas: contacto?.notas || '',
  orden: contacto?.orden ?? 0,
  activo: contacto?.activo ?? true,
});

// Formulario de administrador: crea un contacto o, si llega `contacto`, lo
// edita. `categorias` viene de la página, que ya tiene la lista con sus
// etiquetas.
function ContactoFormulario({ categorias, contacto, onGuardado, onCancelar }) {
  const editando = Boolean(contacto);
  const [datos, setDatos] = useState(datosDe(contacto));
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const manejarCambio = (evento) => {
    const { name, value, type, checked } = evento.target;
    setDatos({ ...datos, [name]: type === 'checkbox' ? checked : value });
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    setError(null);
    setEnviando(true);

    // Los opcionales vacíos se mandan como null: borran lo que hubiera en
    // vez de guardar una cadena vacía (y un email '' ni siquiera pasaría la
    // validación del formato).
    const opcional = (valor) => valor.trim() || null;

    const cuerpo = {
      nombre: datos.nombre.trim(),
      categoria: datos.categoria,
      telefono: datos.telefono.trim(),
      telefono_alternativo: opcional(datos.telefono_alternativo),
      whatsapp: opcional(datos.whatsapp),
      email: opcional(datos.email),
      direccion: opcional(datos.direccion),
      horario: opcional(datos.horario),
      notas: opcional(datos.notas),
      orden: Number(datos.orden) || 0,
      activo: datos.activo,
    };

    try {
      const { data } = editando
        ? await api.patch(`/contactos-interes/${contacto._id}`, cuerpo)
        : await api.post('/contactos-interes', cuerpo);

      onGuardado(data.contacto);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo guardar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="tarjeta-formulario" onSubmit={manejarEnvio}>
      <h2>{editando ? 'Editar contacto' : 'Nuevo contacto'}</h2>

      <label htmlFor="nombre">Nombre</label>
      <input id="nombre" name="nombre" required maxLength={100} value={datos.nombre} onChange={manejarCambio} />

      <label htmlFor="categoria">Categoría</label>
      <select id="categoria" name="categoria" value={datos.categoria} onChange={manejarCambio}>
        {categorias.map((c) => (
          <option key={c.valor} value={c.valor}>
            {c.etiqueta}
          </option>
        ))}
      </select>

      <label htmlFor="telefono">Teléfono</label>
      <input
        id="telefono"
        name="telefono"
        type="tel"
        required
        maxLength={20}
        value={datos.telefono}
        onChange={manejarCambio}
      />

      <label htmlFor="telefono_alternativo">Teléfono alternativo (opcional)</label>
      <input
        id="telefono_alternativo"
        name="telefono_alternativo"
        type="tel"
        maxLength={20}
        value={datos.telefono_alternativo}
        onChange={manejarCambio}
      />

      <label htmlFor="whatsapp">WhatsApp (opcional, con prefijo: 34600123456)</label>
      <input id="whatsapp" name="whatsapp" type="tel" maxLength={20} value={datos.whatsapp} onChange={manejarCambio} />

      <label htmlFor="email">Correo (opcional)</label>
      <input id="email" name="email" type="email" maxLength={100} value={datos.email} onChange={manejarCambio} />

      <label htmlFor="direccion">Dirección (opcional)</label>
      <input id="direccion" name="direccion" maxLength={200} value={datos.direccion} onChange={manejarCambio} />

      <label htmlFor="horario">Horario (opcional)</label>
      <input id="horario" name="horario" maxLength={300} value={datos.horario} onChange={manejarCambio} />

      <label htmlFor="notas">Notas (opcional)</label>
      <input id="notas" name="notas" maxLength={300} value={datos.notas} onChange={manejarCambio} />

      <label htmlFor="orden">Orden dentro de su categoría (menor primero)</label>
      <input id="orden" name="orden" type="number" value={datos.orden} onChange={manejarCambio} />

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
        <input
          type="checkbox"
          name="activo"
          checked={datos.activo}
          onChange={manejarCambio}
          style={{ width: 'auto' }}
        />
        Visible para los vecinos
      </label>

      {error && <p className="mensaje-error">{error}</p>}

      <div className="acciones-formulario">
        <button type="submit" className="btn btn-primario" disabled={enviando}>
          {enviando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear contacto'}
        </button>
        <button type="button" className="btn btn-contorno" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default ContactoFormulario;
