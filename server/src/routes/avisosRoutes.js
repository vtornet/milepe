import { Router } from 'express';
import { crearAviso, exigeCuentaOficial, listarAvisos, obtenerAviso } from '../controllers/avisosController.js';
import { protegido } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

router.get('/', listarAvisos);
router.get('/:id', obtenerAviso);
router.post('/', protegido, exigePerfilCompleto, exigeCuentaOficial, crearAviso);

export default router;
