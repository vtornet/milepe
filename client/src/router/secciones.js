// Fuente unica de verdad para las secciones de MiLepe: rutas, etiquetas y
// los tipos de post con los que se corresponden en el backend (posts.tipo).
// Tanto el router como la navegacion y el muro (para el enlace "ir a su
// seccion") se apoyan en esta lista. tipos es siempre un array -incluso
// cuando una seccion solo tiene uno- porque Empleo se reparte en dos
// (empleo_busco/empleo_ofrezco) y asi no hace falta un caso especial en
// quien la consuma.
export const SECCIONES = [
  { ruta: '/quejas', etiqueta: 'Quejas', tipos: ['queja'] },
  { ruta: '/turismo', etiqueta: 'Turismo', tipos: ['turismo'] },
  { ruta: '/fotos', etiqueta: 'Fotos', tipos: ['foto'] },
  { ruta: '/eventos', etiqueta: 'Eventos', tipos: ['evento'] },
  { ruta: '/tiempo', etiqueta: 'El Tiempo', tipos: [] },
  { ruta: '/empleo', etiqueta: 'Empleo', tipos: ['empleo_busco', 'empleo_ofrezco'] },
  { ruta: '/negocios', etiqueta: 'Negocios', tipos: ['negocio'] },
  { ruta: '/contactos', etiqueta: 'Contactos', tipos: [] },
];
