import api from '../services/api.js';

// Mismos límites que el servidor (middlewares/upload.js): 5 archivos por
// subida, 8 MB cada uno, solo estos formatos. Se repiten aquí para avisar
// antes de gastar datos móviles en una subida que se va a rechazar.
export const MAX_FOTOS = 5;
export const TAMANO_MAXIMO_FOTO = 8 * 1024 * 1024;
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Sube los archivos a Cloudinary a través de la API y devuelve sus URLs, en
// el mismo orden. Con la lista vacía no hace ninguna petición.
export const subirImagenes = async (archivos) => {
  if (archivos.length === 0) return [];

  const formData = new FormData();
  archivos.forEach((archivo) => formData.append('imagenes', archivo));

  const { data } = await api.post('/subidas/imagenes', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return data.imagenes;
};
