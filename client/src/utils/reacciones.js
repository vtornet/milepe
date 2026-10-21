// Las siete reacciones, con su emoji y su nombre en castellano. Mismos
// valores y mismo orden que TIPOS_REACCION en
// server/src/models/constantes.js: el orden es el que se pinta en el
// selector y el que ordena las claves de reacciones_resumen.
//
// 'apoyo' no la tiene ninguna otra red. Hace de "esto también me pasa a
// mí" en una queja, y es la única que le sirve a esa sección: poner "me
// gusta" en un socavón no quiere decir nada.
export const REACCIONES = [
  { tipo: 'me_gusta', emoji: '👍', etiqueta: 'Me gusta' },
  { tipo: 'me_encanta', emoji: '❤️', etiqueta: 'Me encanta' },
  { tipo: 'jaja', emoji: '😂', etiqueta: 'Me divierte' },
  { tipo: 'vaya', emoji: '😮', etiqueta: 'Me asombra' },
  { tipo: 'apoyo', emoji: '🙌', etiqueta: 'Te apoyo' },
  { tipo: 'triste', emoji: '😢', etiqueta: 'Qué pena' },
  { tipo: 'enfado', emoji: '😡', etiqueta: 'Me indigna' },
];

export const REACCION_POR_TIPO = Object.fromEntries(REACCIONES.map((r) => [r.tipo, r]));

// La que se da al pulsar sin más, sin abrir el selector. Es la de siempre
// en cualquier red social: quien quiere poner un 👍 no debería tener que
// elegir entre siete cosas para dejarlo.
export const REACCION_POR_DEFECTO = 'me_gusta';

// Suma de un reacciones_resumen, saltándose lo que no esté. Los posts y
// comentarios anteriores a los tres tipos nuevos no tienen esas claves
// guardadas, así que leerlas devuelve undefined y no cero.
export const contarReacciones = (resumen) =>
  REACCIONES.reduce((suma, r) => suma + (resumen?.[r.tipo] || 0), 0);

export const reaccionesPresentes = (resumen) =>
  REACCIONES.filter((r) => (resumen?.[r.tipo] || 0) > 0);
