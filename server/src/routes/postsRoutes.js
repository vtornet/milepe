import { Router } from 'express';
import {
  listarMuro,
  obtenerPost,
  reaccionarPost,
  reaccionarComentario,
  reportarPost,
  moderarPost,
  listarComentarios,
  crearComentario,
} from '../controllers/postsController.js';
import { protegido, autorizar } from '../middlewares/auth.js';

const router = Router();

router.get('/', listarMuro);
router.get('/:id', obtenerPost);
router.post('/:id/reaccion', protegido, reaccionarPost);
router.post('/:id/reportar', protegido, reportarPost);
router.patch('/:id/moderar', protegido, autorizar('moderador', 'admin'), moderarPost);
router.get('/:id/comentarios', listarComentarios);
router.post('/:id/comentarios', protegido, crearComentario);
router.post('/:id/comentarios/reaccion', protegido, reaccionarComentario);

export default router;
