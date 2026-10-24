import { Link } from 'react-router-dom';
import Icono from './Icono.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { SECCIONES } from '../router/secciones.js';
import { useTitulo } from '../hooks/useTitulo.js';

// Cabecera común de las seis secciones: icono, nombre, una línea de qué es
// esto, y el botón de publicar a la derecha.
//
// Las seis páginas repetían el mismo bloque (un <h1> y un botón "+ Nueva
// ..." con un style inline), y cada una había quedado un poco distinta. El
// icono y la etiqueta salen de secciones.js por la ruta, que ya es la
// fuente única de verdad, así que una sección nueva no tiene que repetirlos
// aquí.
function CabeceraSeccion({ ruta, descripcion, textoNuevo, formularioAbierto, onAlternarFormulario }) {
  const { usuario } = useAuth();
  const seccion = SECCIONES.find((s) => s.ruta === ruta);
  useTitulo(seccion?.etiqueta);

  return (
    <>
      <div className="cabecera-pagina">
        {seccion && (
          <span className="cabecera-pagina-icono" aria-hidden="true">
            <Icono nombre={seccion.icono} tam={22} />
          </span>
        )}

        <div className="cabecera-pagina-texto">
          <h1>{seccion?.etiqueta}</h1>
          {descripcion && <p className="cabecera-pagina-sub">{descripcion}</p>}
        </div>

        {onAlternarFormulario && usuario && (
          <div className="cabecera-pagina-acciones">
            <button
              type="button"
              className={formularioAbierto ? 'btn btn-contorno' : 'btn btn-primario'}
              onClick={onAlternarFormulario}
            >
              <Icono nombre={formularioAbierto ? 'cerrar' : 'anadir'} tam={18} />
              {formularioAbierto ? 'Cancelar' : textoNuevo}
            </button>
          </div>
        )}
      </div>

      {/* Un vecino sin sesión ve la sección entera: solo se le dice qué le
          falta para participar, en vez de esconderle el botón sin más. */}
      {onAlternarFormulario && !usuario && (
        <p className="tarjeta-meta" style={{ marginBottom: 'var(--e-4)' }}>
          <Link to="/login">Inicia sesión</Link> para publicar aquí.
        </p>
      )}
    </>
  );
}

export default CabeceraSeccion;
