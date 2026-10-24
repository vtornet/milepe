import { Router } from 'express';
import { crearAnimal, listarAnimales, obtenerAnimal, resolverAnimal } from '../controllers/animalesController.js';
import { protegido } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

router.get('/', listarAnimales);
router.get('/:id', obtenerAnimal);
router.post('/', protegido, exigePerfilCompleto, crearAnimal);
// El autor o el equipo (lo comprueba el controlador).
router.patch('/:id/resolver', protegido, exigePerfilCompleto, resolverAnimal);

export default router;
