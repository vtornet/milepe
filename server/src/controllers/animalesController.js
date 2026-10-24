import Post from '../models/Post.js';
import AnimalDetalle, { CATEGORIAS_ANIMAL, ESPECIES_ANIMAL } from '../models/AnimalDetalle.js';
import { ZONAS_FARMACIA } from '../models/Farmacia.js';
import ErrorHttp from '../utils/ErrorHttp.js';
import { aPuntoGeoJSON, deGeoJSONaLatLng } from '../utils/geo.js';
import { CAMPOS_PUBLICOS_USUARIO } from '../models/constantes.js';

const formatearAnimal = (post, detalle) => ({
  _id: post._id,
  titulo: post.titulo,
  contenido: post.contenido,
  imagenes: post.imagenes,
  reacciones: post.reacciones_resumen,
  editado: post.editado,
  editado_en: post.editado_en,
  revision_pendiente: post.revision_pendiente,
  num_comentarios: post.num_comentarios,
  fecha_creacion: post.fecha_creacion,
  autor: post.autor_id,
  categoria: detalle.categoria,
  especie: detalle.especie,
  nombre: detalle.nombre,
  sexo: detalle.sexo,
  zona: detalle.zona,
  ubicacion: deGeoJSONaLatLng(detalle.ubicacion),
  fecha_suceso: detalle.fecha_suceso,
  telefono_contacto: detalle.telefono_contacto,
  resuelto: detalle.resuelto,
  fecha_resolucion: detalle.fecha_resolucion,
});

// Foto obligatoria, como en Fotos: un animal perdido sin foto no se puede
// reconocer. Mismo patron de compensacion sin transacciones que el resto.
export const crearAnimal = async (req, res, next) => {
  let post;

  try {
    const { titulo, contenido, imagenes, categoria, especie, nombre, sexo, zona, ubicacion, fecha_suceso, telefono_contacto } =
      req.body;

    if (!Array.isArray(imagenes) || imagenes.length === 0) {
      throw new ErrorHttp(400, 'Añade al menos una foto del animal');
    }

    post = await Post.create({ autor_id: req.usuario._id, tipo: 'animal', titulo, contenido, imagenes });
    const detalle = await AnimalDetalle.create({
      post_id: post._id,
      categoria,
      especie,
      nombre: nombre || null,
      sexo,
      zona,
      ubicacion: ubicacion ? aPuntoGeoJSON(ubicacion) : null,
      fecha_suceso: fecha_suceso || null,
      telefono_contacto: telefono_contacto || null,
    });

    await post.populate('autor_id', CAMPOS_PUBLICOS_USUARIO);
    res.status(201).json({ ok: true, animal: formatearAnimal(post, detalle) });
  } catch (error) {
    if (post) await Post.deleteOne({ _id: post._id });
    next(error);
  }
};

// Por defecto, los no resueltos y los mas recientes primero: un perdido de
// hoy importa mas que una adopcion de hace dos meses. ?incluirResueltos=true
// trae tambien los que ya volvieron a casa o encontraron hogar.
export const listarAnimales = async (req, res, next) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite, 10) || 20));
    const { categoria, especie, zona } = req.query;

    if (categoria && !CATEGORIAS_ANIMAL.includes(categoria)) {
      throw new ErrorHttp(400, `categoria debe ser una de: ${CATEGORIAS_ANIMAL.join(', ')}`);
    }
    if (especie && !ESPECIES_ANIMAL.includes(especie)) {
      throw new ErrorHttp(400, `especie debe ser una de: ${ESPECIES_ANIMAL.join(', ')}`);
    }
    if (zona && !ZONAS_FARMACIA.includes(zona)) {
      throw new ErrorHttp(400, `zona debe ser una de: ${ZONAS_FARMACIA.join(', ')}`);
    }

    const filtroDetalle = {};
    if (categoria) filtroDetalle['detalle.categoria'] = categoria;
    if (especie) filtroDetalle['detalle.especie'] = especie;
    if (zona) filtroDetalle['detalle.zona'] = zona;
    if (req.query.incluirResueltos !== 'true') filtroDetalle['detalle.resuelto'] = false;

    const [resultado] = await Post.aggregate([
      { $match: { tipo: 'animal', estado_moderacion: 'publicado' } },
      { $sort: { fecha_creacion: -1 } },
      { $lookup: { from: 'animaldetalles', localField: '_id', foreignField: 'post_id', as: 'detalle' } },
      { $unwind: '$detalle' },
      { $match: filtroDetalle },
      { $lookup: { from: 'usuarios', localField: 'autor_id', foreignField: '_id', as: 'autor' } },
      { $unwind: '$autor' },
      {
        $facet: {
          items: [
            { $skip: (pagina - 1) * limite },
            { $limit: limite },
            {
              $project: {
                _id: 1,
                titulo: 1,
                contenido: 1,
                imagenes: 1,
                num_comentarios: 1,
                fecha_creacion: 1,
                reacciones: '$reacciones_resumen',
                editado: '$editado',
                editado_en: '$editado_en',
                revision_pendiente: '$revision_pendiente',
                categoria: '$detalle.categoria',
                especie: '$detalle.especie',
                nombre: '$detalle.nombre',
                sexo: '$detalle.sexo',
                zona: '$detalle.zona',
                ubicacion: '$detalle.ubicacion',
                fecha_suceso: '$detalle.fecha_suceso',
                telefono_contacto: '$detalle.telefono_contacto',
                resuelto: '$detalle.resuelto',
                fecha_resolucion: '$detalle.fecha_resolucion',
                autor: {
                  _id: '$autor._id',
                  nombre_usuario: '$autor.nombre_usuario',
                  avatar_url: '$autor.avatar_url',
                  oficial: '$autor.oficial',
                },
              },
            },
          ],
          total: [{ $count: 'valor' }],
        },
      },
    ]);

    const total = resultado.total[0]?.valor || 0;
    res.json({
      ok: true,
      animales: resultado.items.map((a) => ({ ...a, ubicacion: deGeoJSONaLatLng(a.ubicacion) })),
      paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (error) {
    next(error);
  }
};

const cargar = async (id) => {
  const post = await Post.findOne({ _id: id, tipo: 'animal' });
  if (!post || post.estado_moderacion === 'eliminado') throw new ErrorHttp(404, 'Publicación no encontrada');
  const detalle = await AnimalDetalle.findOne({ post_id: post._id });
  if (!detalle) throw new ErrorHttp(404, 'Publicación no encontrada');
  return { post, detalle };
};

export const obtenerAnimal = async (req, res, next) => {
  try {
    const { post, detalle } = await cargar(req.params.id);
    if (post.estado_moderacion !== 'publicado') throw new ErrorHttp(404, 'Publicación no encontrada');
    await post.populate('autor_id', CAMPOS_PUBLICOS_USUARIO);
    res.json({ ok: true, animal: formatearAnimal(post, detalle) });
  } catch (error) {
    next(error);
  }
};

// Marcar como resuelto (o deshacerlo): el autor, o el equipo, que puede
// cerrar uno abandonado cuando alguien avisa en los comentarios de que el
// perro ya apareció.
export const resolverAnimal = async (req, res, next) => {
  try {
    const { post, detalle } = await cargar(req.params.id);
    const esEquipo = req.usuario.rol === 'moderador' || req.usuario.rol === 'admin';
    if (!post.autor_id.equals(req.usuario._id) && !esEquipo) {
      throw new ErrorHttp(403, 'Solo el autor puede marcarlo como resuelto');
    }

    const resuelto = req.body?.resuelto !== false;
    if (resuelto !== detalle.resuelto) {
      detalle.resuelto = resuelto;
      detalle.fecha_resolucion = resuelto ? new Date() : null;
      await detalle.save();
    }

    res.json({ ok: true, resuelto: detalle.resuelto, fecha_resolucion: detalle.fecha_resolucion });
  } catch (error) {
    next(error);
  }
};
