import { Router } from 'express';
import { crearTurismo, listarTurismo, obtenerTurismo } from '../controllers/turismoController.js';
import { protegido } from '../middlewares/auth.js';

const router = Router();

router.get('/', listarTurismo);
router.get('/:id', obtenerTurismo);
router.post('/', protegido, crearTurismo);

export default router;
