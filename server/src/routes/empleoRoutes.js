import { Router } from 'express';
import { crearEmpleo, listarEmpleo, obtenerEmpleo, republicarEmpleo } from '../controllers/empleoController.js';
import { protegido } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

router.get('/', listarEmpleo);
router.get('/:id', obtenerEmpleo);
router.post('/', protegido, exigePerfilCompleto, crearEmpleo);
router.patch('/:id/republicar', protegido, exigePerfilCompleto, republicarEmpleo);

export default router;
