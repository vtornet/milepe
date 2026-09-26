import { Router } from 'express';
import { crearFoto, listarFotos, obtenerFoto } from '../controllers/fotosController.js';
import { protegido } from '../middlewares/auth.js';

const router = Router();

router.get('/', listarFotos);
router.get('/:id', obtenerFoto);
router.post('/', protegido, crearFoto);

export default router;
