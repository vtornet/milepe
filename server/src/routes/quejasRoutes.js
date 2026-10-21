import { Router } from 'express';
import { crearQueja, listarQuejas, obtenerQueja, cambiarEstadoQueja } from '../controllers/quejasController.js';
import { protegido, autorizar } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

router.get('/', listarQuejas);
router.get('/:id', obtenerQueja);
router.post('/', protegido, exigePerfilCompleto, crearQueja);
router.patch('/:id/estado', protegido, exigePerfilCompleto, autorizar('moderador', 'admin'), cambiarEstadoQueja);

export default router;
