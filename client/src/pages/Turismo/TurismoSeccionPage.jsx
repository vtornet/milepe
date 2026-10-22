import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import Icono from '../../components/Icono.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import RecursoTarjeta from './RecursoTarjeta.jsx';
import TurismoFormulario from './TurismoFormulario.jsx';
import { SECCION_TURISMO_POR_VALOR } from './seccionesTurismo.js';

// Una seccion de Turismo: lista informativa de recursos. Solo un admin ve
// los botones de crear/editar/ocultar/eliminar (y los recursos ocultos); la
// API lo vuelve a comprobar con autorizar('admin').
function TurismoSeccionPage() {
  const { seccion: valor } = useParams();
  const seccion = SECCION_TURISMO_POR_VALOR[valor];
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';

  const [recursos, setRecursos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  // null = cerrado, 'nuevo' = creando, o el recurso que se esta editando.
  const [formulario, setFormulario] = useState(null);

  useEffect(() => {
    if (!seccion) return undefined;
    let cancelado = false;
    setCargando(true);
    setError(null);
    setFormulario(null);

    api
      .get(esAdmin ? '/turismo/todos' : '/turismo', { params: { seccion: valor } })
      .then(({ data }) => {
        if (!cancelado) setRecursos(data.recursos);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo cargar esta sección.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [valor, seccion, esAdmin]);

  if (!seccion) return <Navigate to="/turismo" replace />;

  const manejarGuardado = (guardado) => {
    // Si se movio a otra seccion deja de pertenecer a esta lista.
    setRecursos((actuales) => {
      const sinEste = actuales.filter((r) => r._id !== guardado._id);
      return guardado.seccion === valor ? [...sinEste, guardado].sort((a, b) => a.orden - b.orden) : sinEste;
    });
    setFormulario(null);
  };

  return (
    <section>
      <Link to="/turismo" className="enlace-volver">
        <Icono nombre="atras" tam={16} /> Turismo
      </Link>

      <div className="cabecera-pagina">
        <span className="cabecera-pagina-icono" aria-hidden="true">
          {seccion.icono}
        </span>
        <div className="cabecera-pagina-texto">
          <h1>{seccion.etiqueta}</h1>
          <p className="cabecera-pagina-sub">{seccion.descripcion}</p>
        </div>
        {esAdmin && (
          <div className="cabecera-pagina-acciones">
            <button
              type="button"
              className={formulario === 'nuevo' ? 'btn btn-contorno' : 'btn btn-primario'}
              onClick={() => setFormulario(formulario === 'nuevo' ? null : 'nuevo')}
            >
              <Icono nombre={formulario === 'nuevo' ? 'cerrar' : 'anadir'} tam={18} />
              {formulario === 'nuevo' ? 'Cancelar' : 'Nuevo recurso'}
            </button>
          </div>
        )}
      </div>

      {formulario && (
        <TurismoFormulario
          key={formulario === 'nuevo' ? 'nuevo' : formulario._id}
          seccion={valor}
          recurso={formulario === 'nuevo' ? null : formulario}
          onGuardado={manejarGuardado}
          onCancelar={() => setFormulario(null)}
        />
      )}

      {cargando && <EsqueletoFeed />}
      {error && (
        <div className="aviso aviso-error">
          <Icono nombre="alerta" tam={18} />
          <span>{error}</span>
        </div>
      )}
      {!cargando && !error && recursos.length === 0 && (
        <EstadoVacio icono="turismo" titulo="Todavía no hay nada aquí">
          {esAdmin ? 'Añade el primer recurso con el botón de arriba.' : 'Pronto añadiremos información en esta sección.'}
        </EstadoVacio>
      )}

      {recursos.map((recurso) => (
        <RecursoTarjeta
          key={recurso._id}
          recurso={recurso}
          onEditar={esAdmin ? setFormulario : undefined}
          onCambiado={manejarGuardado}
          onEliminado={(id) => setRecursos((actuales) => actuales.filter((r) => r._id !== id))}
        />
      ))}
    </section>
  );
}

export default TurismoSeccionPage;
