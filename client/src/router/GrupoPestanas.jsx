import { NavLink, Outlet } from 'react-router-dom';
import Icono from '../components/Icono.jsx';
import { pestanasDelGrupo } from './secciones.js';

// Pestañas de un grupo de secciones (Tablón: compraventa, animales y empleo;
// Útil: tiempo, farmacias y teléfonos). Cada pestaña sigue siendo su propia
// página y su propia ruta, así que los enlaces de siempre (/empleo,
// /farmacias...) siguen funcionando: el grupo solo añade esta fila arriba.
function GrupoPestanas({ grupo }) {
  return (
    <>
      <nav className="pestanas-grupo" aria-label="Apartados">
        {pestanasDelGrupo(grupo).map((s) => (
          <NavLink key={s.ruta} to={s.ruta} end className={({ isActive }) => (isActive ? 'activa' : undefined)}>
            <Icono nombre={s.icono} tam={16} />
            {s.pestana || s.etiqueta}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}

export default GrupoPestanas;
