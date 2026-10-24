import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import TarjetaPublicacion from '../../components/TarjetaPublicacion.jsx';
import SelectorFotos from '../../components/SelectorFotos.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import Icono from '../../components/Icono.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import { subirImagenes } from '../../utils/subidas.js';
import { useTitulo } from '../../hooks/useTitulo.js';
import { CATEGORIAS_GRUPO } from './categoriasGrupo.js';
import GrupoFormulario from './GrupoFormulario.jsx';

function PublicarEnGrupo({ grupoId, onPublicado }) {
  const [datos, setDatos] = useState({ titulo: '', contenido: '' });
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
      const { data } = await api.post(`/grupos/${grupoId}/publicaciones`, { ...datos, imagenes });
      onPublicado(data.post);
      setDatos({ titulo: '', contenido: '' });
      setArchivos([]);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo publicar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="tarjeta" onSubmit={enviar}>
      <label htmlFor="grupo-pub-titulo">Título (opcional)</label>
      <input id="grupo-pub-titulo" name="titulo" maxLength={120} value={datos.titulo} onChange={cambiar} />
      <label htmlFor="grupo-pub-texto">Qué quieres contar al grupo</label>
      <textarea id="grupo-pub-texto" name="contenido" rows={3} required maxLength={5000} value={datos.contenido} onChange={cambiar} />
      <SelectorFotos archivos={archivos} onChange={setArchivos} />
      {error && <p className="mensaje-error">{error}</p>}
      <button type="submit" disabled={enviando}>
        {enviando ? (archivos.length > 0 ? 'Subiendo fotos...' : 'Publicando...') : 'Publicar en el grupo'}
      </button>
    </form>
  );
}

function GrupoPage() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const [grupo, setGrupo] = useState(null);
  const [soyMiembro, setSoyMiembro] = useState(false);
  const [posts, setPosts] = useState(null);
  const [noExiste, setNoExiste] = useState(false);
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  useTitulo(grupo?.nombre);

  useEffect(() => {
    let cancelado = false;
    setGrupo(null);
    setPosts(null);
    setNoExiste(false);
    api
      .get(`/grupos/${id}`)
      .then(({ data }) => {
        if (cancelado) return;
        setGrupo(data.grupo);
        setSoyMiembro(data.soy_miembro);
      })
      .catch(() => !cancelado && setNoExiste(true));
    api
      .get(`/grupos/${id}/publicaciones`, { params: { limite: 50 } })
      .then(({ data }) => !cancelado && setPosts(data.posts))
      .catch(() => !cancelado && setPosts([]));
    return () => {
      cancelado = true;
    };
  }, [id, usuario]);

  if (noExiste) {
    return (
      <EstadoVacio icono="grupo" titulo="Este grupo no existe" accion={<Link to="/grupos" className="btn btn-primario">Ver los grupos</Link>}>
        Puede que lo hayan retirado.
      </EstadoVacio>
    );
  }
  if (!grupo) return <EsqueletoFeed cuantas={2} />;

  const esCreador = usuario && String(grupo.creador_id?._id) === String(usuario._id);
  const esAdmin = usuario?.rol === 'admin';

  const alternarMiembro = async () => {
    setError(null);
    setOcupado(true);
    try {
      const { data } = soyMiembro ? await api.delete(`/grupos/${id}/miembros`) : await api.post(`/grupos/${id}/miembros`);
      setSoyMiembro(data.soy_miembro);
      setGrupo({ ...grupo, num_miembros: data.num_miembros });
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo completar');
    } finally {
      setOcupado(false);
    }
  };

  const alternarActivo = async () => {
    setError(null);
    try {
      const { data } = await api.patch(`/grupos/${id}`, { activo: !grupo.activo });
      setGrupo({ ...data.grupo, creador_id: grupo.creador_id });
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo cambiar');
    }
  };

  // La tarjeta de cada publicación enlaza a este grupo, no a la lista.
  const seccion = { ruta: `/grupos/${grupo._id}`, etiqueta: grupo.nombre, icono: 'grupo' };

  return (
    <section>
      <Link to="/grupos" className="enlace-volver">
        <Icono nombre="atras" tam={16} /> Grupos
      </Link>

      {editando ? (
        <GrupoFormulario
          grupo={grupo}
          onGuardado={(g) => {
            setGrupo({ ...g, creador_id: grupo.creador_id });
            setEditando(false);
          }}
          onCancelar={() => setEditando(false)}
        />
      ) : (
        <div className="cabecera-pagina">
          <span className="cabecera-pagina-icono" aria-hidden="true">
            <Icono nombre="grupo" tam={22} />
          </span>
          <div className="cabecera-pagina-texto">
            <h1>{grupo.nombre}</h1>
            <p className="cabecera-pagina-sub">
              {CATEGORIAS_GRUPO[grupo.categoria] || grupo.categoria} · {grupo.num_miembros}{' '}
              {grupo.num_miembros === 1 ? 'miembro' : 'miembros'}
              {grupo.creador_id && (
                <>
                  {' '}
                  · lo creó <Link to={`/vecino/${grupo.creador_id._id}`}>{grupo.creador_id.nombre_usuario}</Link>
                </>
              )}
            </p>
          </div>
          {usuario && !esCreador && (
            <div className="cabecera-pagina-acciones">
              <button type="button" className={soyMiembro ? 'btn btn-contorno' : 'btn btn-primario'} disabled={ocupado} onClick={alternarMiembro}>
                {soyMiembro ? 'Salir del grupo' : 'Unirme'}
              </button>
            </div>
          )}
        </div>
      )}

      {!editando && <p>{grupo.descripcion}</p>}
      {!grupo.activo && <p className="aviso aviso-error">Este grupo está retirado: solo lo ven los administradores.</p>}

      {(esCreador || esAdmin) && !editando && (
        <div className="recurso-admin">
          <button type="button" className="btn btn-contorno btn-sm" onClick={() => setEditando(true)}>
            <Icono nombre="lapiz" tam={14} /> Editar
          </button>
          {esAdmin && (
            <button type="button" className="btn btn-plano btn-sm" onClick={alternarActivo}>
              {grupo.activo ? 'Retirar el grupo' : 'Devolver el grupo'}
            </button>
          )}
        </div>
      )}
      {error && <p className="mensaje-error">{error}</p>}

      {soyMiembro && <PublicarEnGrupo grupoId={grupo._id} onPublicado={(p) => setPosts((actuales) => [p, ...(actuales || [])])} />}
      {usuario && !soyMiembro && <p className="tarjeta-meta">Únete para publicar en el grupo.</p>}
      {!usuario && (
        <p className="tarjeta-meta">
          <Link to="/login">Inicia sesión</Link> para unirte y publicar.
        </p>
      )}

      {posts === null && <EsqueletoFeed cuantas={2} />}
      {posts?.length === 0 && (
        <EstadoVacio icono="grupo" titulo="Todavía no hay nada publicado">
          {soyMiembro ? 'Sé el primero en escribir algo.' : 'Cuando los miembros publiquen, aparecerá aquí.'}
        </EstadoVacio>
      )}
      {posts?.map((post) => (
        <TarjetaPublicacion key={post._id} post={post} seccion={seccion} />
      ))}
    </section>
  );
}

export default GrupoPage;
