// Constantes compartidas por mas de un modelo. Viven aparte para evitar
// imports circulares: Reaccion.js necesita los modelos Post y Comentario
// (para mantener su resumen al dia), y esos dos necesitan el mismo listado
// de tipos de reaccion para declarar su campo reacciones_resumen. Si el
// listado viviera dentro de Reaccion.js, Post.js tendria que importar
// Reaccion.js y Reaccion.js importar Post.js a la vez.
export const TIPOS_REACCION = ['me_gusta', 'me_encanta', 'apoyo', 'triste'];

// Contenido que se puede reportar, moderar y apelar. Mismo motivo que
// arriba para vivir aqui: los tres modelos de moderacion (Reporte,
// Apelacion, RegistroModeracion) necesitan el listado, y Reporte ademas
// importa Post/Comentario para auto-ocultar, asi que meterlo en cualquiera
// de ellos crearia un import circular.
export const TIPOS_CONTENIDO_MODERABLE = ['post', 'comentario'];

// Un reporte se clasifica con un motivo de una lista cerrada en vez de con
// texto libre: asi la cola de moderacion se puede agrupar y priorizar por
// motivo (diez reportes de 'discurso_odio' no son diez de 'spam'), y el
// vecino que reporta no tiene que redactar nada. El texto libre sigue
// existiendo, como 'detalle' opcional, para lo que el motivo no recoja.
export const MOTIVOS_REPORTE = [
  'spam',
  'acoso',
  'contenido_inapropiado',
  'informacion_falsa',
  'discurso_odio',
  'otro',
];

// Lo UNICO que se envia al cliente de un usuario ajeno. El nombre y los
// apellidos reales NO estan aqui a proposito: se piden al registrarse para
// que detras de cada cuenta haya una persona identificable, pero son
// privados y no deben salir en una publicacion, un comentario, un mensaje
// ni la cola de moderacion.
//
// Vive aqui, en una constante compartida, precisamente porque antes esta
// lista estaba escrita a mano en una veintena de sitios: con una copia por
// controlador, basta olvidarse de una para filtrar el nombre real de todos
// los vecinos.
export const CAMPOS_PUBLICOS_USUARIO = 'nombre_usuario avatar_url';
