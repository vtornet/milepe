import { Router } from 'express';
import { bloquearUsuario, desbloquearUsuario, listarBloqueados } from '../controllers/usuariosController.js';
import { protegido } from '../middlewares/auth.js';

const router = Router();

router.get('/bloqueados', protegido, listarBloqueados);
router.post('/:id/bloquear', protegido, bloquearUsuario);
router.delete('/:id/bloquear', protegido, desbloquearUsuario);

export default router;
