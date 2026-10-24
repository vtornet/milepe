// Prepara una foto en el propio navegador antes de subirla:
//
// - La reduce a `ladoMaximo` px: una foto de móvil de 12 MB y 4000 px pasa a
//   unos cientos de KB. Sube rápido con mala cobertura y no choca con el
//   límite de 8 MB del servidor.
// - La vuelve a codificar SIEMPRE, también si ya era pequeña: así se pierden
//   sus metadatos EXIF, entre ellos el lugar exacto donde se tomó. La
//   política de privacidad lo promete; no volver a poner aquí un "si ya es
//   pequeña, se sube tal cual".
//
// PNG se queda en PNG (puede tener transparencia, como un logo); el resto pasa
// a JPEG. Los GIF se suben tal cual (podrían ser animados). Si el navegador
// no sabe decodificarla o algo falla, devuelve el archivo sin tocar: mejor
// intentar la subida que bloquearla aquí.
export const reducirImagen = async (archivo, { ladoMaximo = 1600, calidad = 0.85 } = {}) => {
  if (!archivo.type.startsWith('image/') || archivo.type === 'image/gif') return archivo;

  try {
    const mapa = await createImageBitmap(archivo);
    const escala = Math.min(1, ladoMaximo / Math.max(mapa.width, mapa.height));

    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(mapa.width * escala);
    lienzo.height = Math.round(mapa.height * escala);
    lienzo.getContext('2d').drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
    mapa.close?.();

    const esPng = archivo.type === 'image/png';
    const tipo = esPng ? 'image/png' : 'image/jpeg';
    const blob = await new Promise((resolver) => lienzo.toBlob(resolver, tipo, esPng ? undefined : calidad));
    if (!blob) return archivo;

    const base = archivo.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.${esPng ? 'png' : 'jpg'}`, { type: tipo });
  } catch {
    return archivo;
  }
};
