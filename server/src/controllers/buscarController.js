import Post from '../models/Post.js';
import RecursoTuristico from '../models/RecursoTuristico.js';
import ContactoInteres from '../models/ContactoInteres.js';
import Farmacia from '../models/Farmacia.js';
import Grupo from '../models/Grupo.js';
import Usuario from '../models/Usuario.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { CAMPOS_PUBLICOS_USUARIO } from '../models/constantes.js';

// Buscador global: publicaciones de todas las secciones, Turismo, contactos,
// farmacias y vecinos, en una sola consulta.
//
// Con expresiones regulares y no con el indice de texto de Post: aquel esta
// en ingles (lematiza mal el español), solo encuentra palabras enteras ("bach"
// no da "bache") y cambiarlo obliga a migrar el indice en produccion. Con el
// volumen de un pueblo una busqueda por patron es rapida de sobra; si algun
// dia no lo es, el paso es un indice de texto en español o Atlas Search.

const VARIANTES = {
  a: 'aáàäAÁÀÄ',
  e: 'eéèëEÉÈË',
  i: 'iíìïIÍÌÏ',
  o: 'oóòöOÓÒÖ',
  u: 'uúùüUÚÙÜ',
  n: 'nñNÑ',
};

const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "camion" encuentra "Camión": cada vocal (y la n) acepta sus tildes y
// mayusculas. Se añaden las mayusculas a mano porque el modo sin mayusculas
// de la base no siempre pliega las letras acentuadas.
export const patronSinTildes = (palabra) =>
  new RegExp(
    [...escapar(palabra.normalize('NFD').replace(/[̀-ͯ]/g, ''))]
      .map((c) => (VARIANTES[c.toLowerCase()] ? `[${VARIANTES[c.toLowerCase()]}]` : c))
      .join(''),
    'i',
  );

// Todas las palabras tienen que aparecer, en cualquiera de los campos.
const todasLasPalabras = (palabras, campos) => ({
  $and: palabras.map((p) => {
    const patron = patronSinTildes(p);
    return { $or: campos.map((campo) => ({ [campo]: patron })) };
  }),
});

export const buscar = async (req, res, next) => {
  try {
    const consulta = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const palabras = consulta
      .split(/\s+/)
      .filter((p) => p.length >= 2)
      .slice(0, 5);

    if (palabras.length === 0) {
      throw new ErrorHttp(400, 'Escribe al menos dos letras para buscar');
    }

    const [publicaciones, turismo, contactos, farmacias, vecinos, grupos] = await Promise.all([
      Post.find({ estado_moderacion: 'publicado', ...todasLasPalabras(palabras, ['titulo', 'contenido']) })
        .sort({ fecha_creacion: -1 })
        .limit(20)
        .populate('autor_id', CAMPOS_PUBLICOS_USUARIO),
      RecursoTuristico.find({ activo: true, ...todasLasPalabras(palabras, ['titulo', 'descripcion']) })
        .limit(5)
        .select('titulo seccion direccion'),
      ContactoInteres.find({ activo: true, ...todasLasPalabras(palabras, ['nombre', 'notas']) })
        .limit(5)
        .select('nombre telefono categoria'),
      Farmacia.find({ activa: true, ...todasLasPalabras(palabras, ['nombre', 'direccion']) })
        .limit(5)
        .select('nombre direccion telefono zona'),
      // Vecinos solo con sesion, como el buscador de Mensajes: listar cuentas
      // a cualquiera que pregunte no aporta nada a quien no participa.
      req.usuario
        ? Usuario.find({ activo: true, ...todasLasPalabras(palabras, ['nombre_usuario']) })
            .limit(5)
            .select(CAMPOS_PUBLICOS_USUARIO)
        : [],
      // Los grupos son públicos: salen con o sin sesión.
      Grupo.find({ activo: true, ...todasLasPalabras(palabras, ['nombre', 'descripcion']) })
        .sort({ num_miembros: -1 })
        .limit(5)
        .select('nombre categoria num_miembros'),
    ]);

    res.json({ ok: true, consulta, publicaciones, turismo, contactos, farmacias, vecinos, grupos });
  } catch (error) {
    next(error);
  }
};
