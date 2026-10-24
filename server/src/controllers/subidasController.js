import subirImagen from '../utils/subirImagen.js';
import ErrorHttp from '../utils/ErrorHttp.js';

// Sube 1 o varias imagenes (multipart/form-data, campo "imagenes") a
// Cloudinary y devuelve sus URLs. Generico: cualquier seccion que necesite
// imagenes (Fotos, Quejas, Turismo, Negocios...) llama a esto primero y
// luego crea su post con las URLs ya en mano, en vez de que cada seccion
// reimplemente su propia subida.
export const subirImagenes = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw new ErrorHttp(400, 'No se ha enviado ninguna imagen');
    }

    const resultados = await Promise.all(req.files.map((archivo) => subirImagen(archivo.buffer)));

    res.status(201).json({
      ok: true,
      imagenes: resultados.map((r) => r.secure_url),
    });
  } catch (error) {
    next(error);
  }
};

// La foto de perfil: una sola imagen, en su propia carpeta. Ruta aparte de
// /imagenes porque se usa ANTES de tener el perfil completo (es uno de los
// datos que lo completan).
export const subirAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ErrorHttp(400, 'No se ha enviado ninguna imagen');
    }
    const resultado = await subirImagen(req.file.buffer, { carpeta: 'milepe/avatares' });
    res.status(201).json({ ok: true, imagenes: [resultado.secure_url] });
  } catch (error) {
    next(error);
  }
};
