// Etiquetas (#feria, #ObrasCalleReal) dentro del título o el texto de una
// publicación. Se guardan normalizadas en Post.etiquetas (ver el hook del
// modelo) para poder listar "todo lo de #feria" con un índice.
//
// La misma regla vive en client/src/utils/etiquetas.js, que es quien las
// pinta como enlaces; test/etiquetas.test.js comprueba que las dos encuentran
// las mismas. Si cambias una, cambia la otra.

// Precedida de inicio o de algo que no sea letra, cifra, "/", "&" o "#":
// así "milepe.com/#arriba" o "&#39;" no son etiquetas.
export const PATRON_ETIQUETA = /(^|[^\p{L}\p{N}_/&#])#([\p{L}\p{N}_]{2,40})/gu;
export const MAX_ETIQUETAS = 10;

// "#Feria", "#feria" y "#féria" son la misma. La ñ se conserva: "año" y
// "ano" no son la misma palabra.
export const normalizarEtiqueta = (texto) =>
  texto
    .normalize('NFC')
    .toLowerCase()
    .normalize('NFD')
    // Fuera tildes y diéresis, salvo la virgulilla de la ñ.
    .replace(/(?<!n)\u0303|[\u0300-\u0302\u0304-\u036f]/g, '')
    .normalize('NFC');

// Una etiqueta tiene que llevar alguna letra: "#1" es un número, no un tema.
const esEtiqueta = (cuerpo) => /\p{L}/u.test(cuerpo);

export const extraerEtiquetas = (...textos) => {
  const vistas = new Set();
  for (const texto of textos) {
    if (!texto) continue;
    for (const [, , cuerpo] of texto.matchAll(PATRON_ETIQUETA)) {
      if (esEtiqueta(cuerpo)) vistas.add(normalizarEtiqueta(cuerpo));
      if (vistas.size === MAX_ETIQUETAS) return [...vistas];
    }
  }
  return [...vistas];
};
