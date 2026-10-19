import Icono from './Icono.jsx';

// Estado vacio con forma: icono, que ha pasado y que se puede hacer. Un
// "Todavia no hay publicaciones." suelto no se distingue de un error de
// carga, y no dice por donde seguir. En una red social recien abierta
// (donde casi todo esta vacio) esta pantalla se ve mucho, asi que merece
// tener el mismo cuidado que el contenido.
function EstadoVacio({ icono = 'muro', titulo, children, accion }) {
  return (
    <div className="vacio">
      <div className="vacio-icono">
        <Icono nombre={icono} tam={24} />
      </div>
      <h3>{titulo}</h3>
      {children && <p>{children}</p>}
      {accion}
    </div>
  );
}

export default EstadoVacio;
