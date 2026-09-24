// Fuente unica de verdad para las secciones de MiLepe: rutas, etiquetas y el
// tipo de post con el que se corresponden en el backend (posts.tipo).
// Tanto el router como la navegacion y el muro (para el enlace "ir a su
// seccion") se apoyan en esta lista.
export const SECCIONES = [
  { ruta: '/quejas', etiqueta: 'Quejas', tipo: 'queja' },
  { ruta: '/turismo', etiqueta: 'Turismo', tipo: 'turismo' },
  { ruta: '/fotos', etiqueta: 'Fotos', tipo: 'foto' },
  { ruta: '/eventos', etiqueta: 'Eventos', tipo: 'evento' },
  { ruta: '/tiempo', etiqueta: 'El Tiempo', tipo: null },
  { ruta: '/empleo', etiqueta: 'Empleo', tipo: 'empleo' },
  { ruta: '/negocios', etiqueta: 'Negocios', tipo: 'negocio' },
  { ruta: '/contactos', etiqueta: 'Contactos', tipo: null },
];
