// Reduce una foto en el propio navegador antes de subirla: una foto de móvil
// de 12 MB y 4000 px pasa a unos cientos de KB a `ladoMaximo` px. Sube rápido
// con mala cobertura y no choca con el límite de 8 MB del servidor.
//
// Si el navegador no sabe decodificarla (un HEIC en Android, por ejemplo) o
// algo falla, devuelve el archivo tal cual: mejor intentar la subida que
// bloquearla aquí.
export const reducirImagen = async (archivo, { ladoMaximo = 1600, calidad = 0.85 } = {}) => {
  if (!archivo.type.startsWith('image/') || archivo.type === 'image/gif') return archivo;

  try {
    const mapa = await createImageBitmap(archivo);
    const escala = Math.min(1, ladoMaximo / Math.max(mapa.width, mapa.height));
    // Ya es pequeña y ligera: no se toca (recomprimir solo perdería calidad).
    if (escala === 1 && archivo.size < 1.5 * 1024 * 1024) {
      mapa.close?.();
      return archivo;
    }

    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(mapa.width * escala);
    lienzo.height = Math.round(mapa.height * escala);
    lienzo.getContext('2d').drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
    mapa.close?.();

    const blob = await new Promise((resolver) => lienzo.toBlob(resolver, 'image/jpeg', calidad));
    if (!blob) return archivo;
    return new File([blob], archivo.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return archivo;
  }
};
