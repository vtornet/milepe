import { v2 as cloudinary } from 'cloudinary';

/**
 * Configura el SDK de Cloudinary con las credenciales del .env.
 * Los modulos de subida de imagenes (multer-storage-cloudinary) importan
 * esta instancia ya configurada.
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
