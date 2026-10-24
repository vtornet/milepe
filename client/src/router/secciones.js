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
  { ruta: '/empleo', etiqueta: 'Empleo', icono: 'empleo', tipos: ['empleo_busco', 'empleo_ofrezco'] },
  { ruta: '/tiempo', etiqueta: 'El Tiempo', icono: 'tiempo', tipos: [] },
  { ruta: '/farmacias', etiqueta: 'Farmacias', icono: 'farmacia', tipos: [] },
  { ruta: '/contactos', etiqueta: 'Contactos', icono: 'contactos', tipos: [] },
];

// tipo de Post -> seccion a la que pertenece. 'muro' no aparece: es
// contenido general y no tiene seccion propia.
export const SECCION_POR_TIPO = Object.fromEntries(
  SECCIONES.flatMap((seccion) => seccion.tipos.map((tipo) => [tipo, seccion])),
);
