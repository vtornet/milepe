import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import CabeceraSeccion from '../../components/CabeceraSeccion.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import { CATEGORIAS_GRUPO } from './categoriasGrupo.js';
import GrupoFormulario from './GrupoFormulario.jsx';

function GruposPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [grupos, setGrupos] = useState(null);
  const [mios, setMios] = useState([]);
  const [error, setError] = useState(null);
  const [formulario, setFormulario] = useState(false);
  const [categoria, setCategoria] = useState('');

  useEffect(() => {
    let cancelado = false;
    setGrupos(null);
    api
      .get('/grupos', { params: categoria ? { categoria } : {} })
      .then(({ data }) => !cancelado && setGrupos(data.grupos))
      .catch(() => !cancelado && setError('No se pudieron cargar los grupos.'));
    return () => {
      cancelado = true;
    };
  }, [categoria]);

  useEffect(() => {
    if (!usuario) return;
    api
      .get('/grupos/mios')
      .then(({ data }) => setMios(data.grupos))
      .catch(() => {});
  }, [usuario]);

  // Los míos primero: es lo que se viene a mirar.
  const ordenados = grupos && [...grupos].sort((a, b) => mios.includes(b._id) - mios.includes(a._id));

  return (
    <section>
      <CabeceraSeccion
        ruta="/grupos"
        descripcion="Barrios, asociaciones, hermandades, peñas y clubes de Lepe."
        textoNuevo="Nuevo grupo"
        formularioAbierto={formulario}
        onAlternarFormulario={() => setFormulario(!formulario)}
      />

      {formulario && <GrupoFormulario onGuardado={(nuevo) => navigate(`/grupos/${nuevo._id}`)} />}

      <div className="fila" style={{ gap: 'var(--e-2)', flexWrap: 'wrap', marginBottom: 'var(--e-3)' }}>
        <label className="solo-lectores" htmlFor="grupos-filtro">
          Tipo de grupo
        </label>
        <select id="grupos-filtro" value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Todos</option>
          {Object.entries(CATEGORIAS_GRUPO).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mensaje-error">{error}</p>}
      {!error && grupos === null && <EsqueletoFeed cuantas={2} />}
      {grupos?.length === 0 && (
        <EstadoVacio icono="grupo" titulo="Todavía no hay grupos">
          Crea el de tu barrio, tu peña o tu asociación y avisa a los demás.
        </EstadoVacio>
      )}

      {ordenados?.map((g) => (
        <Link key={g._id} to={`/grupos/${g._id}`} className="tarjeta tarjeta-pulsable" style={{ display: 'block', textDecoration: 'none' }}>
          <div className="fila" style={{ justifyContent: 'space-between', gap: 'var(--e-2)' }}>
            <strong>{g.nombre}</strong>
            {mios.includes(g._id) && <span className="insignia insignia-exito">Estás dentro</span>}
          </div>
          <p className="tarjeta-meta">
            {CATEGORIAS_GRUPO[g.categoria] || g.categoria} · {g.num_miembros} {g.num_miembros === 1 ? 'miembro' : 'miembros'}
          </p>
          <p className="texto-suave">{g.descripcion.length > 160 ? `${g.descripcion.slice(0, 159)}…` : g.descripcion}</p>
        </Link>
      ))}
    </section>
  );
}

export default GruposPage;
