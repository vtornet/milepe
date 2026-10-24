import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api.js';
import Icono from '../../components/Icono.jsx';
import Avatar from '../../components/Avatar.jsx';
import TarjetaPublicacion from '../../components/TarjetaPublicacion.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import { SECCION_POR_TIPO } from '../../router/secciones.js';
import { useTitulo } from '../../hooks/useTitulo.js';

const enlaceTelefono = (telefono) => `tel:${telefono.split(/[/;,]/)[0].replace(/[^\d+]/g, '')}`;

// Buscador global: la caja de la barra superior trae aquí con ?q=, y en el
// móvil (donde esa caja no cabe) se llega desde el menú.
function BuscarPage() {
  const [parametros] = useSearchParams();
  const navigate = useNavigate();
  const q = parametros.get('q') || '';
  useTitulo(q ? `Buscar «${q}»` : 'Buscar');

  const [texto, setTexto] = useState(q);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setTexto(q);
    if (q.trim().length < 2) {
      setResultado(null);
      return undefined;
    }
    let cancelado = false;
    setResultado(null);
    setError(null);
    api
      .get('/buscar', { params: { q } })
      .then(({ data }) => !cancelado && setResultado(data))
      .catch((err) => !cancelado && setError(err.response?.data?.mensaje || 'No se pudo buscar.'));
    return () => {
      cancelado = true;
    };
  }, [q]);

  const enviar = (e) => {
    e.preventDefault();
    navigate(`/buscar?q=${encodeURIComponent(texto.trim())}`);
  };

  const total = resultado
    ? resultado.publicaciones.length + resultado.turismo.length + resultado.contactos.length + resultado.farmacias.length + resultado.vecinos.length
    : 0;

  return (
    <section>
      <form className="fila" onSubmit={enviar} role="search" style={{ gap: 'var(--e-2)', marginBottom: 'var(--e-4)' }}>
        <label className="solo-lectores" htmlFor="buscar-pagina">
          Buscar en MiLepe
        </label>
        <input
          id="buscar-pagina"
          type="search"
          placeholder="Buscar en Lepe..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoFocus={!q}
        />
        <button type="submit" className="btn btn-primario">
          <Icono nombre="buscar" tam={17} /> Buscar
        </button>
      </form>

      {error && <p className="mensaje-error">{error}</p>}
      {q && !resultado && !error && <EsqueletoFeed cuantas={2} />}

      {resultado && total === 0 && (
        <EstadoVacio icono="buscar" titulo={`Nada para «${resultado.consulta}»`}>
          Prueba con otra palabra o con menos palabras.
        </EstadoVacio>
      )}

      {resultado?.contactos.length > 0 && (
        <>
          <h2 className="contactos-titulo">Teléfonos de interés</h2>
          {resultado.contactos.map((c) => (
            <div key={c._id} className="tarjeta fila" style={{ justifyContent: 'space-between' }}>
              <strong>{c.nombre}</strong>
              <a href={enlaceTelefono(c.telefono)}>{c.telefono}</a>
            </div>
          ))}
        </>
      )}

      {resultado?.farmacias.length > 0 && (
        <>
          <h2 className="contactos-titulo">Farmacias</h2>
          {resultado.farmacias.map((f) => (
            <div key={f._id} className="tarjeta fila" style={{ justifyContent: 'space-between' }}>
              <span>
                <strong>{f.nombre}</strong> <span className="tarjeta-meta">{f.direccion}</span>
              </span>
              {f.telefono && <a href={enlaceTelefono(f.telefono)}>{f.telefono}</a>}
            </div>
          ))}
          <Link to="/farmacias" className="btn btn-plano btn-sm">
            Ver las de guardia
          </Link>
        </>
      )}

      {resultado?.turismo.length > 0 && (
        <>
          <h2 className="contactos-titulo">Turismo</h2>
          {resultado.turismo.map((r) => (
            <Link key={r._id} to={`/turismo/${r.seccion}`} className="tarjeta fila" style={{ textDecoration: 'none' }}>
              <strong>{r.titulo}</strong>
              {r.direccion && <span className="tarjeta-meta"> · {r.direccion}</span>}
            </Link>
          ))}
        </>
      )}

      {resultado?.vecinos.length > 0 && (
        <>
          <h2 className="contactos-titulo">Vecinos</h2>
          {resultado.vecinos.map((v) => (
            <Link key={v._id} to={`/vecino/${v._id}`} className="tarjeta fila" style={{ textDecoration: 'none', gap: 'var(--e-3)' }}>
              <Avatar usuario={v} tamano="sm" />
              <strong>{v.nombre_usuario}</strong>
            </Link>
          ))}
        </>
      )}

      {resultado?.publicaciones.length > 0 && (
        <>
          <h2 className="contactos-titulo">Publicaciones</h2>
          {resultado.publicaciones.map((p) => (
            <TarjetaPublicacion key={p._id} post={p} seccion={SECCION_POR_TIPO[p.tipo]} />
          ))}
        </>
      )}
    </section>
  );
}

export default BuscarPage;
