import { Router } from 'express';
import { crearTurismo, listarTurismo, obtenerTurismo } from '../controllers/turismoController.js';
import { protegido } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

router.get('/', listarTurismo);
router.get('/:id', obtenerTurismo);
router.post('/', protegido, exigePerfilCompleto, crearTurismo);

export default router;
