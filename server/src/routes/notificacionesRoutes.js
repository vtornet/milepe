import { Router } from 'express';
import { listarNotificaciones, marcarLeida, marcarTodasLeidas } from '../controllers/notificacionesController.js';
import { protegido } from '../middlewares/auth.js';

const router = Router();

router.get('/', protegido, listarNotificaciones);
router.patch('/leidas', protegido, marcarTodasLeidas);
router.patch('/:id/leida', protegido, marcarLeida);

export default router;
