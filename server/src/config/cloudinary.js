import { v2 as cloudinary } from 'cloudinary';

/**
 * Configura el SDK de Cloudinary con las credenciales del .env.
 * utils/subirImagen.js importa esta instancia ya configurada para subir
 * por stream (multer en memoria + streamifier, no multer-storage-cloudinary:
 * ver CLAUDE.md "Image uploads").
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
