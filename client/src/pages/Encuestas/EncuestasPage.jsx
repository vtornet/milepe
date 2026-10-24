import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import CabeceraSeccion from '../../components/CabeceraSeccion.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import Icono from '../../components/Icono.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import EncuestaTarjeta from './EncuestaTarjeta.jsx';

const MAX_OPCIONES = 6;

const dentroDe = (dias) => {
  const d = new Date(Date.now() + dias * 86400000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function EncuestaFormulario({ onCreada }) {
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [opciones, setOpciones] = useState(['', '']);
  const [cierra, setCierra] = useState(dentroDe(7));
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cambiarOpcion = (i, valor) => setOpciones(opciones.map((o, j) => (j === i ? valor : o)));

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const { data } = await api.post('/encuestas', {
        titulo,
        contenido,
        opciones: opciones.map((o) => o.trim()).filter(Boolean),
        cierra_en: new Date(cierra).toISOString(),
      });
      onCreada(data.encuesta);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo publicar la encuesta');
      setEnviando(false);
    }
  };

  return (
    <form className="tarjeta" onSubmit={enviar}>
      <h2>Nueva encuesta</h2>

      <label htmlFor="encuesta-titulo">Pregunta</label>
      <input id="encuesta-titulo" required maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} />

      <label htmlFor="encuesta-contenido">Explicación</label>
      <textarea id="encuesta-contenido" rows={2} required maxLength={5000} value={contenido} onChange={(e) => setContenido(e.target.value)} />

      <label>Opciones (de 2 a {MAX_OPCIONES})</label>
      {opciones.map((o, i) => (
        <div key={i} className="fila" style={{ gap: 'var(--e-2)' }}>
          <input required maxLength={80} value={o} onChange={(e) => cambiarOpcion(i, e.target.value)} placeholder={`Opción ${i + 1}`} />
          {opciones.length > 2 && (
            <button type="button" className="btn btn-plano btn-sm" onClick={() => setOpciones(opciones.filter((_, j) => j !== i))}>
              <Icono nombre="cerrar" tam={14} />
            </button>
          )}
        </div>
      ))}
      {opciones.length < MAX_OPCIONES && (
        <button type="button" className="btn btn-plano btn-sm" onClick={() => setOpciones([...opciones, ''])}>
          <Icono nombre="anadir" tam={14} /> Añadir opción
        </button>
      )}

      <label htmlFor="encuesta-cierre">Se cierra el</label>
      <input id="encuesta-cierre" type="datetime-local" required value={cierra} onChange={(e) => setCierra(e.target.value)} />

      <p className="tarjeta-meta">El voto es anónimo. Los resultados se ven al votar o cuando se cierra.</p>
      {error && <p className="mensaje-error">{error}</p>}
      <button type="submit" disabled={enviando}>
        {enviando ? 'Publicando…' : 'Publicar encuesta'}
      </button>
    </form>
  );
}

function EncuestasPage() {
  const { usuario } = useAuth();
  const [encuestas, setEncuestas] = useState(null);
  const [misVotos, setMisVotos] = useState({});
  const [error, setError] = useState(null);
  const [formulario, setFormulario] = useState(false);

  useEffect(() => {
    let cancelado = false;
    api
      .get('/encuestas')
      .then(({ data }) => !cancelado && setEncuestas(data.encuestas))
      .catch(() => !cancelado && setError('No se pudieron cargar las encuestas.'));
    if (usuario) {
      api
        .get('/encuestas/mis-votos')
        .then(({ data }) => !cancelado && setMisVotos(data.votos))
        .catch(() => {});
    }
    return () => {
      cancelado = true;
    };
  }, [usuario]);

  // Las que ya he votado se piden enteras: el listado no trae resultados.
  const [completas, setCompletas] = useState({});
  useEffect(() => {
    const pendientes = Object.keys(misVotos).filter((id) => !completas[id]);
    pendientes.forEach((id) =>
      api
        .get(`/encuestas/${id}`)
        .then(({ data }) => setCompletas((actual) => ({ ...actual, [id]: data.encuesta })))
        .catch(() => {}),
    );
  }, [misVotos, completas]);

  return (
    <section>
      <CabeceraSeccion
        ruta="/encuestas"
        descripcion="Encuestas y consultas: qué opina Lepe."
        textoNuevo="Nueva encuesta"
        formularioAbierto={formulario}
        onAlternarFormulario={() => setFormulario(!formulario)}
      />

      {formulario && (
        <EncuestaFormulario
          onCreada={(nueva) => {
            setEncuestas((actuales) => [nueva, ...(actuales || [])]);
            setFormulario(false);
          }}
        />
      )}

      {error && <p className="mensaje-error">{error}</p>}
      {!error && encuestas === null && <EsqueletoFeed cuantas={2} />}
      {encuestas?.length === 0 && (
        <EstadoVacio icono="encuesta" titulo="Todavía no hay encuestas">
          Pregunta algo al pueblo: dónde poner un parque, qué fiesta recuperar…
        </EstadoVacio>
      )}
      {encuestas?.map((e) => (
        <EncuestaTarjeta key={e._id} encuesta={completas[e._id] || e} />
      ))}
    </section>
  );
}

export default EncuestasPage;
