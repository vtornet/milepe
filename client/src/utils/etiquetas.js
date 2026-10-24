// Misma regla que server/src/utils/etiquetas.js (el servidor es quien las
// guarda; esto solo las pinta como enlaces). Si cambias una, cambia la otra:
// server/test/etiquetas.test.js comprueba que coinciden.
const PATRON_ETIQUETA = /(^|[^\p{L}\p{N}_/&#])#([\p{L}\p{N}_]{2,40})/gu;

export const normalizarEtiqueta = (texto) =>
  texto
    .normalize('NFC')
    .toLowerCase()
    .normalize('NFD')
    // Fuera tildes y diéresis, salvo la virgulilla de la ñ.
    .replace(/(?<!n)\u0303|[\u0300-\u0302\u0304-\u036f]/g, '')
    .normalize('NFC');

// Parte un texto en trozos: { texto } normales y { etiqueta, original } para
// cada #etiqueta, que se pintan como enlace a /etiqueta/<etiqueta>.
export const trocearConEtiquetas = (texto) => {
  const trozos = [];
  let desde = 0;
  for (const m of texto.matchAll(PATRON_ETIQUETA)) {
    const [, previo, cuerpo] = m;
    if (!/\p{L}/u.test(cuerpo)) continue;
    const inicio = m.index + previo.length;
    if (inicio > desde) trozos.push({ texto: texto.slice(desde, inicio) });
    trozos.push({ etiqueta: normalizarEtiqueta(cuerpo), original: `#${cuerpo}` });
    desde = inicio + cuerpo.length + 1;
  }
  if (desde < texto.length) trozos.push({ texto: texto.slice(desde) });
  return trozos;
};
