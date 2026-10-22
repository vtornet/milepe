import { v2 as cloudinary } from 'cloudinary';

/**
 * Configura el SDK de Cloudinary con las credenciales del .env.
 * utils/subirImagen.js importa esta instancia ya configurada para subir
 * por stream (multer en memoria + streamifier, no multer-storage-cloudinary:
 * ver CLAUDE.md "Image uploads").
 */

// Se recortan los espacios: pegar "CLOUDINARY_CLOUD_NAME= nombre" (con un
// espacio tras el =) en el panel de Railway o en el .env es facil de hacer
// y Cloudinary lo rechaza con "Invalid cloud_name  nombre" (401), que las
// subidas devuelven como un 500 sin pista de la causa.
const limpio = (valor) => (valor || '').trim();

cloudinary.config({
  cloud_name: limpio(process.env.CLOUDINARY_CLOUD_NAME),
  api_key: limpio(process.env.CLOUDINARY_API_KEY),
  api_secret: limpio(process.env.CLOUDINARY_API_SECRET),
});

export default cloudinary;
