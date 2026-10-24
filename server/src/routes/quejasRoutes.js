import { Router } from 'express';
import {
  crearQueja,
  listarQuejas,
  obtenerQueja,
  cambiarEstadoQueja,
  exigeGestorQuejas,
  resumenQuejas,
} from '../controllers/quejasController.js';
import { protegido } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

router.get('/', listarQuejas);
// Antes de /:id, o Express leeria "resumen" como un id.
router.get('/resumen', resumenQuejas);
router.get('/:id', obtenerQueja);
router.post('/', protegido, exigePerfilCompleto, crearQueja);
router.patch('/:id/estado', protegido, exigePerfilCompleto, exigeGestorQuejas, cambiarEstadoQueja);

export default router;
