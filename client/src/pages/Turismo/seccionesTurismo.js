// Mismo enum que server/src/models/RecursoTuristico.js
// (SECCIONES_TURISMO). El orden de esta lista es el orden de las tarjetas.
export const SECCIONES_TURISMO = [
  { valor: 'sol_y_playa', etiqueta: 'Sol y playa', icono: '🏖️', descripcion: 'Playas urbanas con todos los servicios y playas salvajes en plena naturaleza.' },
  { valor: 'turismo_activo', etiqueta: 'Turismo activo', icono: '⛳', descripcion: 'Golf, deportes náuticos, rutas a caballo y actividades al aire libre.' },
  { valor: 'turismo_cultural', etiqueta: 'Turismo cultural', icono: '⛪', descripcion: 'Monumentos, fiestas, costumbres y rincones con historia.' },
  { valor: 'gastronomia', etiqueta: 'Gastronomía', icono: '🍤', descripcion: 'Zampuzos, restaurantes y bares: cocina casera, marisco y vino de la tierra.' },
  { valor: 'alojamientos', etiqueta: 'Alojamientos', icono: '🛏️', descripcion: 'Hoteles, pensiones y alojamientos rurales donde quedarse.' },
  { valor: 'servicios_turisticos', etiqueta: 'Servicios turísticos', icono: '🛍️', descripcion: 'Ocio, compras y servicios pensados para el visitante.' },
  { valor: 'rutas', etiqueta: 'Rutas', icono: '🥾', descripcion: 'Senderos y vías verdes para recorrer a pie o en bici.' },
];

export const SECCION_TURISMO_POR_VALOR = Object.fromEntries(SECCIONES_TURISMO.map((s) => [s.valor, s]));
