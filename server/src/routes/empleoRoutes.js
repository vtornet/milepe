import { Router } from 'express';
import { crearEmpleo, listarEmpleo, obtenerEmpleo, republicarEmpleo } from '../controllers/empleoController.js';
import { protegido } from '../middlewares/auth.js';

const router = Router();

router.get('/', listarEmpleo);
router.get('/:id', obtenerEmpleo);
router.post('/', protegido, crearEmpleo);
router.patch('/:id/republicar', protegido, republicarEmpleo);

export default router;
