import streamifier from 'streamifier';
import cloudinary from '../config/cloudinary.js';

// Sube un Buffer (lo que deja multer en memoria, req.file.buffer) a
// Cloudinary via stream, sin escribir nada a disco. Es el patron que
// sustituye a multer-storage-cloudinary (descontinuado, solo soporta
// Cloudinary v1): ver CLAUDE.md "Image uploads".
const subirImagen = (buffer, { carpeta = 'milepe' } = {}) =>
  new Promise((resolve, reject) => {
    const streamSubida = cloudinary.uploader.upload_stream({ folder: carpeta }, (error, resultado) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(resultado);
    });

    streamifier.createReadStream(buffer).pipe(streamSubida);
  });

export default subirImagen;
