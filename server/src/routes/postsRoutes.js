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
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

router.get('/', listarMuro);
router.get('/:id', obtenerPost);
router.post('/:id/reaccion', protegido, exigePerfilCompleto, reaccionarPost);
router.post('/:id/reportar', protegido, exigePerfilCompleto, reportarPost);
router.patch('/:id/moderar', protegido, exigePerfilCompleto, autorizar('moderador', 'admin'), moderarPost);
router.get('/:id/comentarios', listarComentarios);
router.post('/:id/comentarios', protegido, exigePerfilCompleto, crearComentario);
router.post('/:id/comentarios/reaccion', protegido, exigePerfilCompleto, reaccionarComentario);

export default router;
