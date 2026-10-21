import { Router } from 'express';
import {
  listarNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
  clavePublicaParaSuscribirse,
  guardarSuscripcion,
  borrarSuscripcion,
} from '../controllers/notificacionesController.js';
import { protegido } from '../middlewares/auth.js';

const router = Router();

router.get('/', protegido, listarNotificaciones);
router.patch('/leidas', protegido, marcarTodasLeidas);

// Avisos push. Van antes de /:id/leida por lo de siempre: que "push" no se
// tome por el id de una notificacion.
router.get('/push/clave', protegido, clavePublicaParaSuscribirse);
router.post('/push', protegido, guardarSuscripcion);
router.delete('/push', protegido, borrarSuscripcion);
router.patch('/:id/leida', protegido, marcarLeida);

export default router;
