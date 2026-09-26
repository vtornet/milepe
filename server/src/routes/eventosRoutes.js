import { Router } from 'express';
import { crearEvento, listarEventos, obtenerEvento } from '../controllers/eventosController.js';
import { protegido } from '../middlewares/auth.js';

const router = Router();

router.get('/', listarEventos);
router.get('/:id', obtenerEvento);
router.post('/', protegido, crearEvento);

export default router;
