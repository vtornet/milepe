import { Router } from 'express';
import { crearFoto, listarFotos, obtenerFoto } from '../controllers/fotosController.js';
import { protegido } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

router.get('/', listarFotos);
router.get('/:id', obtenerFoto);
router.post('/', protegido, exigePerfilCompleto, crearFoto);

export default router;
