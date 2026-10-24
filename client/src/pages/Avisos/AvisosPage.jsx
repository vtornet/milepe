import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import CabeceraSeccion from '../../components/CabeceraSeccion.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import Icono from '../../components/Icono.jsx';
import TarjetaPublicacion, { Dato } from '../../components/TarjetaPublicacion.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import { fechaHora } from '../../utils/fechas.js';

// Mismo enum que server/src/models/AvisoDetalle.js (CATEGORIAS_AVISO).
const CATEGORIAS_AVISO = {
  agua: 'Agua',
  trafico: 'Tráfico',
  obras: 'Obras',
  bando: 'Bando',
  limpieza: 'Limpieza',
  emergencia: 'Emergencia',
  otro: 'Otro',
};

const INICIAL = { titulo: '', contenido: '', categoria: 'agua', vigente_hasta: '' };

function AvisoFormulario({ onCreado }) {
  const [datos, setDatos] = useState(INICIAL);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (e) => setDatos({ ...datos, [e.target.name]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const { data } = await api.post('/avisos', {
        ...datos,
        // datetime-local va sin zona: el navegador lo interpreta en la hora del vecino.
        vigente_hasta: datos.vigente_hasta ? new Date(datos.vigente_hasta).toISOString() : null,
      });
      onCreado(data.aviso);
      setDatos(INICIAL);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo publicar el aviso');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="tarjeta" onSubmit={enviar}>
      <h2>Nuevo aviso oficial</h2>

      <label htmlFor="aviso-titulo">Título</label>
      <input id="aviso-titulo" name="titulo" required maxLength={120} value={datos.titulo} onChange={cambiar} />

      <label htmlFor="aviso-contenido">Texto</label>
      <textarea id="aviso-contenido" name="contenido" rows={4} required maxLength={5000} value={datos.contenido} onChange={cambiar} />

      <label htmlFor="aviso-categoria">Tipo</label>
      <select id="aviso-categoria" name="categoria" value={datos.categoria} onChange={cambiar}>
        {Object.entries(CATEGORIAS_AVISO).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </select>

      <label htmlFor="aviso-vigencia">Vigente hasta (opcional: deja de destacarse después)</label>
      <input id="aviso-vigencia" name="vigente_hasta" type="datetime-local" value={datos.vigente_hasta} onChange={cambiar} />

      {error && <p className="mensaje-error">{error}</p>}
      <button type="submit" disabled={enviando}>
        {enviando ? 'Publicando...' : 'Publicar aviso'}
      </button>
    </form>
  );
}

function TarjetaAviso({ aviso }) {
  return (
    <TarjetaPublicacion
      post={aviso}
      chips={
        <>
          <span className="insignia insignia-info">{CATEGORIAS_AVISO[aviso.categoria] || aviso.categoria}</span>
          {!aviso.vigente && <span className="insignia">Caducado</span>}
        </>
      }
      datos={aviso.vigente_hasta && <Dato icono="reloj">Vigente hasta el {fechaHora(aviso.vigente_hasta)}</Dato>}
    />
  );
}

function AvisosPage() {
  const { usuario } = useAuth();
  const puedePublicar = Boolean(usuario?.oficial || usuario?.rol === 'admin');

  const [avisos, setAvisos] = useState(null);
  const [error, setError] = useState(null);
  const [verCaducados, setVerCaducados] = useState(false);
  const [formulario, setFormulario] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setAvisos(null);
    api
      .get('/avisos', { params: verCaducados ? { incluirCaducados: 'true', limite: 50 } : { limite: 50 } })
      .then(({ data }) => !cancelado && setAvisos(data.avisos))
      .catch(() => !cancelado && setError('No se pudieron cargar los avisos.'));
    return () => {
      cancelado = true;
    };
  }, [verCaducados]);

  return (
    <section>
      <CabeceraSeccion
        ruta="/avisos"
        descripcion="Avisos oficiales del Ayuntamiento: cortes, obras, tráfico y bandos."
        textoNuevo="Nuevo aviso"
        formularioAbierto={formulario}
        onAlternarFormulario={puedePublicar ? () => setFormulario(!formulario) : undefined}
      />

      {formulario && (
        <AvisoFormulario
          onCreado={(nuevo) => {
            setAvisos((actuales) => [nuevo, ...(actuales || [])]);
            setFormulario(false);
          }}
        />
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 'var(--e-3) 0' }}>
        <input type="checkbox" checked={verCaducados} onChange={(e) => setVerCaducados(e.target.checked)} style={{ width: 'auto' }} />
        Ver también los avisos caducados
      </label>

      {error && (
        <div className="aviso aviso-error">
          <Icono nombre="alerta" tam={18} />
          <span>{error}</span>
        </div>
      )}
      {!error && avisos === null && <EsqueletoFeed cuantas={2} />}
      {avisos?.length === 0 && (
        <EstadoVacio icono="aviso" titulo="No hay avisos vigentes">
          Cuando el Ayuntamiento publique un aviso, aparecerá aquí y arriba del <Link to="/">Muro</Link>.
        </EstadoVacio>
      )}
      {avisos?.map((a) => (
        <TarjetaAviso key={a._id} aviso={a} />
      ))}
    </section>
  );
}

export default AvisosPage;
