import { Router } from 'express';
import {
  listarMuro,
  obtenerPost,
  listarMisReacciones,
  editarPost,
  listarEdiciones,
  reaccionarPost,
  reaccionarComentario,
  reportarPost,
  moderarPost,
  listarComentarios,
  crearComentario,
} from '../controllers/postsController.js';
import { protegido, autorizar } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

router.get('/', listarMuro);
// Antes de '/:id' a proposito: si fuera despues, Express entenderia
// "mis-reacciones" como el id de un post y contestaria un CastError.
router.get('/mis-reacciones', protegido, listarMisReacciones);
router.get('/:id', obtenerPost);
// Editar: solo el autor, comprobado en el controlador. Pide perfil
// completo igual que publicar, porque editar es publicar otra vez.
router.patch('/:id', protegido, exigePerfilCompleto, editarPost);
// El historial lo ve el autor o el equipo; quien decide es el controlador,
// porque aqui no se sabe todavia de quien es el post.
router.get('/:id/ediciones', protegido, listarEdiciones);
router.post('/:id/reaccion', protegido, exigePerfilCompleto, reaccionarPost);
router.post('/:id/reportar', protegido, exigePerfilCompleto, reportarPost);
router.patch('/:id/moderar', protegido, exigePerfilCompleto, autorizar('moderador', 'admin'), moderarPost);
router.get('/:id/comentarios', listarComentarios);
router.post('/:id/comentarios', protegido, exigePerfilCompleto, crearComentario);
router.post('/:id/comentarios/reaccion', protegido, exigePerfilCompleto, reaccionarComentario);

export default router;
