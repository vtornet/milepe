import multer from 'multer';
import ErrorHttp from '../utils/ErrorHttp.js';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const TAMANO_MAXIMO_BYTES = 8 * 1024 * 1024; // 8 MB

// En memoria (Buffer), nunca en disco: de ahi Buffer.from(...) en
// subirImagen.js. El archivo nunca toca el disco del servidor, solo pasa
// por memoria camino de Cloudinary.
const almacenamiento = multer.memoryStorage();

const filtroArchivo = (req, file, cb) => {
  if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
    cb(new ErrorHttp(400, `Tipo de imagen no permitido: ${file.mimetype}`));
    return;
  }
  cb(null, true);
};

const upload = multer({
  storage: almacenamiento,
  fileFilter: filtroArchivo,
  limits: { fileSize: TAMANO_MAXIMO_BYTES, files: 5 },
});

export default upload;
