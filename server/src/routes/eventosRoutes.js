import { Router } from 'express';
import { crearEvento, listarEventos, obtenerEvento } from '../controllers/eventosController.js';
import { protegido } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

router.get('/', listarEventos);
router.get('/:id', obtenerEvento);
router.post('/', protegido, exigePerfilCompleto, crearEvento);

export default router;
