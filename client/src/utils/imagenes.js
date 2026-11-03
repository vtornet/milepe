// Las URLs de Cloudinary admiten transformaciones en la propia ruta: pedir
// la imagen al ancho que se va a pintar (y en el formato que mejor soporte
// el navegador, f_auto, con calidad automatica) ahorra mucho mas que
// cualquier otra optimizacion: una foto de movil de 4000 px pesa varios MB y
// aqui se pinta a 700. Una URL que no sea de Cloudinary se devuelve igual.
export const redimensionada = (url, ancho) => {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${ancho},c_limit/`);
};

// Varios anchos de la misma foto para srcset: el navegador elige el que
// necesita según el hueco (sizes) y la densidad de la pantalla, así que un
// móvil normal no se baja la versión de un móvil de gama alta. Cloudinary
// genera cada variante una vez y la cachea. Con una URL que no es de
// Cloudinary no hay variantes: undefined deja el src tal cual.
export const srcsetDe = (url, anchos) => {
  if (!url || !url.includes('/upload/')) return undefined;
  return anchos.map((ancho) => `${redimensionada(url, ancho)} ${ancho}w`).join(', ');
};
