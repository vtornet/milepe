// Constantes compartidas por mas de un modelo. Viven aparte para evitar
// imports circulares: Reaccion.js necesita los modelos Post y Comentario
// (para mantener su resumen al dia), y esos dos necesitan el mismo listado
// de tipos de reaccion para declarar su campo reacciones_resumen. Si el
// listado viviera dentro de Reaccion.js, Post.js tendria que importar
// Reaccion.js y Reaccion.js importar Post.js a la vez.
export const TIPOS_REACCION = ['me_gusta', 'me_encanta', 'apoyo', 'triste'];
