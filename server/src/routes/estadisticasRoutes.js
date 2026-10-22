import { Router } from 'express';
import { obtenerEstadisticas } from '../controllers/estadisticasController.js';
import { protegido, autorizar } from '../middlewares/auth.js';

const router = Router();

// Solo admin: son datos agregados de toda la red, no del equipo de moderacion.
router.get('/', protegido, autorizar('admin'), obtenerEstadisticas);

export default router;
