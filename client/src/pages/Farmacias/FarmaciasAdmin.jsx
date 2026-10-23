import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api.js';
import Icono from '../../components/Icono.jsx';
import SelectorUbicacion from '../Quejas/SelectorUbicacion.jsx';
import { interpretarCalendario } from '../../utils/calendarioGuardias.js';
import { ZONAS, etiquetaMes } from './utilidades.js';

const mensajeDe = (err, porDefecto) => err.response?.data?.mensaje || porDefecto;

const datosDe = (farmacia) => ({
  nombre: farmacia?.nombre || '',
  zona: farmacia?.zona || 'lepe',
  direccion: farmacia?.direccion || '',
  telefono: farmacia?.telefono || '',
  horario: farmacia?.horario || '',
  activa: farmacia?.activa ?? true,
});

function FormularioFarmacia({ farmacia, onGuardada, onCancelar }) {
  const editando = Boolean(farmacia);
  const [datos, setDatos] = useState(datosDe(farmacia));
  const [ubicacion, setUbicacion] = useState(farmacia?.ubicacion || null);
  const [conMapa, setConMapa] = useState(Boolean(farmacia?.ubicacion));
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (evento) => {
    const { name, value, type, checked } = evento.target;
    setDatos({ ...datos, [name]: type === 'checkbox' ? checked : value });
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    setError(null);
    setEnviando(true);

    // Los opcionales vacíos van como null: borran lo que hubiera.
    const opcional = (valor) => valor.trim() || null;
    const cuerpo = {
      nombre: datos.nombre.trim(),
      zona: datos.zona,
      direccion: opcional(datos.direccion),
      telefono: opcional(datos.telefono),
      horario: opcional(datos.horario),
      activa: datos.activa,
      ubicacion: conMapa && ubicacion ? ubicacion : null,
    };

    try {
      const { data } = editando
        ? await api.patch(`/farmacias/${farmacia._id}`, cuerpo)
        : await api.post('/farmacias', cuerpo);
      onGuardada(data.farmacia);
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo guardar la farmacia'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="tarjeta-formulario" onSubmit={enviar}>
      <h3>{editando ? 'Editar farmacia' : 'Nueva farmacia'}</h3>

      <label htmlFor="farm-nombre">Nombre (tal como aparece en el cuadro del Colegio)</label>
      <input id="farm-nombre" name="nombre" required maxLength={100} value={datos.nombre} onChange={cambiar} />

      <label htmlFor="farm-zona">Zona</label>
      <select id="farm-zona" name="zona" value={datos.zona} onChange={cambiar}>
        {Object.entries(ZONAS).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </select>

      <label htmlFor="farm-direccion">Dirección (opcional)</label>
      <input id="farm-direccion" name="direccion" maxLength={200} value={datos.direccion} onChange={cambiar} />

      <label htmlFor="farm-telefono">Teléfono (opcional)</label>
      <input id="farm-telefono" name="telefono" type="tel" maxLength={30} value={datos.telefono} onChange={cambiar} />

      <label htmlFor="farm-horario">Horario habitual (opcional)</label>
      <input id="farm-horario" name="horario" maxLength={300} value={datos.horario} onChange={cambiar} />

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
        <input type="checkbox" checked={conMapa} onChange={(e) => setConMapa(e.target.checked)} style={{ width: 'auto' }} />
        Marcar la ubicación en el mapa (para «Cómo llegar»)
      </label>
      {conMapa && <SelectorUbicacion value={ubicacion} onChange={setUbicacion} />}

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
        <input type="checkbox" name="activa" checked={datos.activa} onChange={cambiar} style={{ width: 'auto' }} />
        En activo (aparece en el directorio)
      </label>

      {error && <p className="mensaje-error">{error}</p>}

      <div className="acciones-formulario">
        <button type="submit" className="btn btn-primario" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="btn btn-contorno" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FilaFarmacia({ farmacia, onEditar, onCambio }) {
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  const ejecutar = async (accion, mensaje) => {
    setError(null);
    setOcupado(true);
    try {
      await accion();
      onCambio();
    } catch (err) {
      setError(mensajeDe(err, mensaje));
      setConfirmando(false);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className={`tarjeta${farmacia.activa ? '' : ' recurso-oculto'}`}>
      <strong>{farmacia.nombre}</strong> <span className="tarjeta-meta">· {ZONAS[farmacia.zona]}</span>
      {!farmacia.activa && <span className="insignia insignia-aviso">Inactiva</span>}

      <div className="recurso-admin">
        {confirmando ? (
          <>
            <span className="tarjeta-meta">¿Eliminar para siempre?</span>
            <button
              type="button"
              className="btn btn-peligro btn-sm"
              disabled={ocupado}
              onClick={() => ejecutar(() => api.delete(`/farmacias/${farmacia._id}`), 'No se pudo eliminar')}
            >
              Sí, eliminar
            </button>
            <button type="button" className="btn btn-contorno btn-sm" onClick={() => setConfirmando(false)}>
              No
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-contorno btn-sm" onClick={() => onEditar(farmacia)}>
              <Icono nombre="lapiz" tam={14} /> Editar
            </button>
            <button
              type="button"
              className="btn btn-contorno btn-sm"
              disabled={ocupado}
              onClick={() =>
                ejecutar(() => api.patch(`/farmacias/${farmacia._id}`, { activa: !farmacia.activa }), 'No se pudo cambiar')
              }
            >
              {farmacia.activa ? 'Desactivar' : 'Activar'}
            </button>
            <button type="button" className="btn btn-plano btn-sm" onClick={() => setConfirmando(true)}>
              Eliminar
            </button>
          </>
        )}
      </div>
      {error && <p className="mensaje-error">{error}</p>}
    </div>
  );
}

// Carga del calendario de un mes: se pega el texto del cuadro del Colegio,
// se ve cuántas guardias se han entendido y cuáles no, y se sube.
function CargarCalendario({ mesInicial, onCambio }) {
  const [mes, setMes] = useState(mesInicial || '');
  const [texto, setTexto] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [estado, setEstado] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (mesInicial) setMes((actual) => actual || mesInicial);
  }, [mesInicial]);

  const { guardias, errores } = interpretarCalendario(texto, mes);
  const puedeEnviar = Boolean(mes) && guardias.length > 0 && errores.length === 0;

  const enviar = async () => {
    setEstado(null);
    setOcupado(true);
    try {
      const { data } = await api.put(`/farmacias/guardias/${mes}`, { guardias });
      setEstado({ tipo: 'ok', texto: `Calendario de ${etiquetaMes(mes)} cargado: ${data.guardias} guardias.` });
      setTexto('');
      onCambio();
    } catch (err) {
      setEstado({ tipo: 'error', texto: mensajeDe(err, 'No se pudo cargar el calendario') });
    } finally {
      setOcupado(false);
      setConfirmando(false);
    }
  };

  const vaciar = async () => {
    setEstado(null);
    setOcupado(true);
    try {
      const { data } = await api.delete(`/farmacias/guardias/${mes}`);
      setEstado({ tipo: 'ok', texto: `Se han quitado ${data.eliminadas} guardias de ${etiquetaMes(mes)}.` });
      onCambio();
    } catch (err) {
      setEstado({ tipo: 'error', texto: mensajeDe(err, 'No se pudo vaciar el mes') });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="tarjeta-formulario">
      <h3>Cargar el calendario de un mes</h3>
      <p className="tarjeta-meta">
        Pega el cuadro del mes, <strong>una guardia por línea</strong>, con <code>;</code> entre las partes. Vale con
        fecha (<code>2026-10-03;Farmacia;9:30-22:00</code>) o como patrón semanal, que es como lo publica el Colegio:{' '}
        <code>L-V;Farmacia;9:30-22:00</code>, <code>S</code>, <code>D</code>, <code>festivos</code> o{' '}
        <code>todos;Farmacia;24h</code>. Los festivos del mes se indican con <code>festivo;12/10/2026</code>: ese día
        solo cuentan las líneas «festivos» y «todos». La farmacia puede escribirse como en el cuadro (con «Lda.», nombre
        de pila y dirección) siempre que exista en el directorio. Si el mes ya tenía calendario, se{' '}
        <strong>sustituye entero</strong>.
      </p>

      <label htmlFor="cal-mes">Mes</label>
      <input id="cal-mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />

      <label htmlFor="cal-texto">Guardias</label>
      <textarea
        id="cal-texto"
        rows={10}
        value={texto}
        placeholder={'L-V;Farmacia Sánchez Martín;9:30-22:00\nS;Farmacia Sánchez Martín;9:30-22:00\ntodos;Farmacia Vacas Barranco;24h\nfestivo;12/10/2026'}
        onChange={(e) => setTexto(e.target.value)}
      />

      {texto.trim() && (
        <p className="tarjeta-meta">
          {guardias.length} guardia(s) entendida(s)
          {errores.length > 0 && ` · ${errores.length} línea(s) sin entender`}
        </p>
      )}
      {errores.length > 0 && (
        <ul className="mensaje-error">
          {errores.slice(0, 8).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {estado && <p className={estado.tipo === 'ok' ? 'tarjeta-meta' : 'mensaje-error'}>{estado.texto}</p>}

      <div className="acciones-formulario">
        {confirmando ? (
          <>
            <span className="tarjeta-meta">¿Sustituir el calendario de {etiquetaMes(mes)}?</span>
            <button type="button" className="btn btn-primario" disabled={ocupado} onClick={enviar}>
              {ocupado ? 'Cargando…' : 'Sí, cargar'}
            </button>
            <button type="button" className="btn btn-contorno" onClick={() => setConfirmando(false)}>
              No
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primario" disabled={!puedeEnviar || ocupado} onClick={() => setConfirmando(true)}>
              Cargar calendario
            </button>
            <button type="button" className="btn btn-plano" disabled={!mes || ocupado} onClick={vaciar}>
              Vaciar el mes
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Zona de administrador de la página de Farmacias. Solo se monta con
// rol admin; la API vuelve a comprobarlo en cada llamada.
function FarmaciasAdmin({ mes, onCambio }) {
  const [farmacias, setFarmacias] = useState([]);
  const [formulario, setFormulario] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(() => {
    api
      .get('/farmacias/todas')
      .then(({ data }) => setFarmacias(data.farmacias))
      .catch(() => setError('No se pudo cargar el directorio de administración.'));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambio = () => {
    cargar();
    onCambio();
  };

  return (
    <div style={{ marginTop: 'var(--e-6)' }}>
      <h2 className="contactos-titulo">Administración</h2>

      <CargarCalendario mesInicial={mes} onCambio={cambio} />

      <div className="cabecera-pagina" style={{ marginTop: 'var(--e-5)' }}>
        <div className="cabecera-pagina-texto">
          <h3>Directorio de farmacias</h3>
        </div>
        <div className="cabecera-pagina-acciones">
          <button
            type="button"
            className={formulario === 'nueva' ? 'btn btn-contorno' : 'btn btn-primario'}
            onClick={() => setFormulario(formulario === 'nueva' ? null : 'nueva')}
          >
            <Icono nombre={formulario === 'nueva' ? 'cerrar' : 'anadir'} tam={18} />
            {formulario === 'nueva' ? 'Cancelar' : 'Nueva farmacia'}
          </button>
        </div>
      </div>

      {formulario && (
        <FormularioFarmacia
          key={formulario === 'nueva' ? 'nueva' : formulario._id}
          farmacia={formulario === 'nueva' ? null : formulario}
          onGuardada={() => {
            setFormulario(null);
            cambio();
          }}
          onCancelar={() => setFormulario(null)}
        />
      )}

      {error && <p className="mensaje-error">{error}</p>}
      {farmacias.map((f) => (
        <FilaFarmacia key={f._id} farmacia={f} onEditar={setFormulario} onCambio={cambio} />
      ))}
    </div>
  );
}

export default FarmaciasAdmin;
