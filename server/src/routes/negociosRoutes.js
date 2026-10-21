import { Router } from 'express';
import { crearNegocio, listarNegocios, obtenerNegocio } from '../controllers/negociosController.js';
import { protegido } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

router.get('/', listarNegocios);
router.get('/:id', obtenerNegocio);
router.post('/', protegido, exigePerfilCompleto, crearNegocio);

export default router;
