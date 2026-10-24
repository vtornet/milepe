import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import CabeceraSeccion from '../../components/CabeceraSeccion.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import Icono from '../../components/Icono.jsx';
import SelectorFotos from '../../components/SelectorFotos.jsx';
import TarjetaPublicacion, { Dato } from '../../components/TarjetaPublicacion.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import { subirImagenes } from '../../utils/subidas.js';
import { fechaCorta } from '../../utils/fechas.js';

// Mismos enums que server/src/models/AnuncioDetalle.js.
const CATEGORIAS = {
  vendo: 'Vendo',
  regalo: 'Regalo',
  busco: 'Busco',
  perdido: 'Objeto perdido',
  encontrado: 'Objeto encontrado',
  ayuda: 'Ayuda vecinal',
};
const ZONAS = { lepe: 'Lepe', la_antilla: 'La Antilla', islantilla: 'Islantilla', otra: 'Otra zona' };

const INICIAL = { titulo: '', contenido: '', categoria: 'vendo', precio: '', zona: 'lepe' };

const formatoPrecio = (precio) => (precio === 0 ? 'Gratis' : `${precio.toLocaleString('es-ES')} €`);

function AnuncioFormulario({ onCreado }) {
  const [datos, setDatos] = useState(INICIAL);
  const [archivos, setArchivos] = useState([]);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (e) => setDatos({ ...datos, [e.target.name]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const imagenes = await subirImagenes(archivos);
      const { data } = await api.post('/anuncios', {
        ...datos,
        precio: datos.categoria === 'vendo' ? datos.precio : null,
        imagenes,
      });
      onCreado(data.anuncio);
      setDatos(INICIAL);
      setArchivos([]);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo publicar el anuncio');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="tarjeta" onSubmit={enviar}>
      <h2>Nuevo anuncio</h2>

      <label htmlFor="anuncio-categoria">Qué es</label>
      <select id="anuncio-categoria" name="categoria" value={datos.categoria} onChange={cambiar}>
        {Object.entries(CATEGORIAS).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </select>

      <label htmlFor="anuncio-titulo">Título</label>
      <input id="anuncio-titulo" name="titulo" required maxLength={120} value={datos.titulo} onChange={cambiar} />

      <label htmlFor="anuncio-contenido">Descripción</label>
      <textarea id="anuncio-contenido" name="contenido" rows={3} required maxLength={5000} value={datos.contenido} onChange={cambiar} />

      {datos.categoria === 'vendo' && (
        <>
          <label htmlFor="anuncio-precio">Precio (€)</label>
          <input id="anuncio-precio" name="precio" type="number" min="0" step="1" required value={datos.precio} onChange={cambiar} />
        </>
      )}

      <label htmlFor="anuncio-zona">Zona</label>
      <select id="anuncio-zona" name="zona" value={datos.zona} onChange={cambiar}>
        {Object.entries(ZONAS).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </select>

      <SelectorFotos archivos={archivos} onChange={setArchivos} />

      <p className="tarjeta-meta">
        El anuncio se ve 30 días; luego puedes renovarlo. Los vecinos te contestarán en los comentarios.
      </p>

      {error && <p className="mensaje-error">{error}</p>}
      <button type="submit" disabled={enviando}>
        {enviando ? (archivos.length > 0 ? 'Subiendo fotos...' : 'Publicando...') : 'Publicar anuncio'}
      </button>
    </form>
  );
}

function AnuncioTarjeta({ anuncio: inicial }) {
  const { usuario } = useAuth();
  const [anuncio, setAnuncio] = useState(inicial);
  const [error, setError] = useState(null);

  const autorId = anuncio.autor?._id || anuncio.autor_id;
  const soyElAutor = Boolean(usuario && String(autorId) === String(usuario._id));

  const accion = async (ruta, cuerpo) => {
    setError(null);
    try {
      const { data } = await api.patch(`/anuncios/${anuncio._id}/${ruta}`, cuerpo);
      setAnuncio({ ...anuncio, ...data });
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo cambiar el anuncio');
    }
  };

  const caducado = !anuncio.cerrado && !anuncio.vigente;

  return (
    <TarjetaPublicacion
      post={anuncio}
      chips={
        <>
          <span className="insignia insignia-info">{CATEGORIAS[anuncio.categoria] || anuncio.categoria}</span>
          {anuncio.precio !== null && anuncio.precio !== undefined && (
            <span className="insignia insignia-marca">{formatoPrecio(anuncio.precio)}</span>
          )}
          {anuncio.cerrado && <span className="insignia">Cerrado</span>}
          {caducado && <span className="insignia insignia-aviso">Caducado</span>}
        </>
      }
      datos={<Dato icono="ubicacion">{ZONAS[anuncio.zona]}</Dato>}
    >
      {soyElAutor && (
        <div className="recurso-admin">
          <span className="tarjeta-meta">
            {anuncio.cerrado ? 'Cerrado' : `Visible hasta el ${fechaCorta(anuncio.fecha_caducidad)}`}
          </span>
          <button type="button" className="btn btn-contorno btn-sm" onClick={() => accion('cerrar', { cerrado: !anuncio.cerrado })}>
            {anuncio.cerrado ? 'Reabrir' : 'Marcar como cerrado'}
          </button>
          {!anuncio.cerrado && (
            <button type="button" className="btn btn-plano btn-sm" onClick={() => accion('renovar', {})}>
              Renovar 30 días
            </button>
          )}
        </div>
      )}
      {error && <p className="mensaje-error">{error}</p>}
    </TarjetaPublicacion>
  );
}

function TablonPage() {
  const [anuncios, setAnuncios] = useState(null);
  const [error, setError] = useState(null);
  const [categoria, setCategoria] = useState('');
  const [zona, setZona] = useState('');
  const [verCerrados, setVerCerrados] = useState(false);
  const [formulario, setFormulario] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setAnuncios(null);
    const params = {};
    if (categoria) params.categoria = categoria;
    if (zona) params.zona = zona;
    if (verCerrados) params.incluirCerrados = 'true';

    api
      .get('/anuncios', { params })
      .then(({ data }) => !cancelado && setAnuncios(data.anuncios))
      .catch(() => !cancelado && setError('No se pudo cargar el tablón.'));
    return () => {
      cancelado = true;
    };
  }, [categoria, zona, verCerrados]);

  return (
    <section>
      <CabeceraSeccion
        ruta="/tablon"
        descripcion="Segunda mano, regalos, objetos perdidos y ayuda entre vecinos. Los animales tienen su propia sección."
        textoNuevo="Nuevo anuncio"
        formularioAbierto={formulario}
        onAlternarFormulario={() => setFormulario(!formulario)}
      />

      {formulario && (
        <AnuncioFormulario
          onCreado={(nuevo) => {
            setAnuncios((actuales) => [nuevo, ...(actuales || [])]);
            setFormulario(false);
          }}
        />
      )}

      <div className="lista-filtros">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todo</option>
          {Object.entries(CATEGORIAS).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
        <select value={zona} onChange={(e) => setZona(e.target.value)}>
          <option value="">Todas las zonas</option>
          {Object.entries(ZONAS).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={verCerrados} onChange={(e) => setVerCerrados(e.target.checked)} style={{ width: 'auto' }} />
          Ver cerrados y caducados
        </label>
      </div>

      {error && (
        <div className="aviso aviso-error">
          <Icono nombre="alerta" tam={18} />
          <span>{error}</span>
        </div>
      )}
      {!error && anuncios === null && <EsqueletoFeed cuantas={2} />}
      {anuncios?.length === 0 && (
        <EstadoVacio icono="tablon" titulo="No hay anuncios">
          Publica lo que vendes, regalas o buscas, o avisa de algo perdido.
        </EstadoVacio>
      )}
      {anuncios?.map((a) => (
        <AnuncioTarjeta key={a._id} anuncio={a} />
      ))}
    </section>
  );
}

export default TablonPage;
