// Fuente unica de verdad para las secciones de MiLepe: rutas, etiquetas,
// icono y los tipos de post con los que se corresponden en el backend
// (posts.tipo). El router, la navegacion (lateral, pestanas de movil y hoja
// de "Mas") y el muro (para el enlace "ir a su seccion") se apoyan en esta
// lista.
//
// - tipos es siempre un array -incluso cuando una seccion solo tiene uno-
//   porque Empleo se reparte en dos (empleo_busco/empleo_ofrezco) y asi no
//   hace falta un caso especial en quien la consuma.
// - icono es el nombre de un icono de components/Icono.jsx.
// - principal marca las que van en la barra de pestanas del movil, que solo
//   caben cuatro; el resto viven en la hoja de "Mas".
export const SECCIONES = [
  { ruta: '/avisos', etiqueta: 'Avisos', icono: 'aviso', tipos: ['aviso'] },
  { ruta: '/quejas', etiqueta: 'Quejas', icono: 'quejas', tipos: ['queja'], principal: true },
  { ruta: '/eventos', etiqueta: 'Eventos', icono: 'eventos', tipos: ['evento'], principal: true },
  { ruta: '/fotos', etiqueta: 'Fotos', icono: 'fotos', tipos: ['foto'] },
  { ruta: '/turismo', etiqueta: 'Turismo', icono: 'turismo', tipos: [] },
  { ruta: '/negocios', etiqueta: 'Negocios', icono: 'negocios', tipos: ['negocio'] },
  // Grupo Tablón: en el menú solo sale su cabeza (/tablon); el resto son
  // pestañas dentro de él (ver GrupoPestanas). Siguen teniendo su ruta.
  { ruta: '/tablon', etiqueta: 'Tablón', pestana: 'Compraventa y más', icono: 'tablon', tipos: ['anuncio'], grupo: 'tablon' },
  { ruta: '/animales', etiqueta: 'Animales', icono: 'animal', tipos: ['animal'], grupo: 'tablon' },
  { ruta: '/empleo', etiqueta: 'Empleo', icono: 'empleo', tipos: ['empleo_busco', 'empleo_ofrezco'], grupo: 'tablon' },
  // Grupo Útil: la cabeza no tiene página propia (/util lleva a la primera
  // pestaña), por eso soloMenu.
  { ruta: '/util', etiqueta: 'Útil', icono: 'util', tipos: [], grupo: 'util', soloMenu: true },
  { ruta: '/tiempo', etiqueta: 'El Tiempo', pestana: 'Tiempo y playa', icono: 'tiempo', tipos: [], grupo: 'util' },
  { ruta: '/farmacias', etiqueta: 'Farmacias', pestana: 'Farmacias de guardia', icono: 'farmacia', tipos: [], grupo: 'util' },
  { ruta: '/contactos', etiqueta: 'Contactos', pestana: 'Teléfonos', icono: 'contactos', tipos: [], grupo: 'util' },
  // No es una seccion de contenido, pero en el movil la caja de busqueda de
  // la barra superior no cabe y desde aqui se llega a ella.
  { ruta: '/buscar', etiqueta: 'Buscar', icono: 'buscar', tipos: [] },
];

const esCabeza = (s) => s.ruta === `/${s.grupo}`;

// Lo que sale en los menús: las secciones sueltas y la cabeza de cada grupo.
export const SECCIONES_MENU = SECCIONES.filter((s) => !s.grupo || esCabeza(s));

// Las pestañas de un grupo, en orden.
export const pestanasDelGrupo = (grupo) => SECCIONES.filter((s) => s.grupo === grupo && !s.soloMenu);

// Qué entrada del menú debe ir encendida en una ruta: dentro de /farmacias,
// la de "Útil".
export const rutaDelMenu = (pathname) => {
  const seccion = SECCIONES.find((s) => pathname === s.ruta || pathname.startsWith(`${s.ruta}/`));
  if (!seccion) return null;
  return seccion.grupo ? `/${seccion.grupo}` : seccion.ruta;
};

// tipo de Post -> seccion a la que pertenece. 'muro' no aparece: es
// contenido general y no tiene seccion propia.
export const SECCION_POR_TIPO = Object.fromEntries(
  SECCIONES.flatMap((seccion) => seccion.tipos.map((tipo) => [tipo, seccion])),
);
