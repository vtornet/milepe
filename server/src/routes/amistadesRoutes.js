import { Router } from 'express';
import {
  enviarSolicitud,
  aceptarSolicitud,
  eliminarAmistad,
  listarAmigos,
  listarSolicitudesPendientes,
} from '../controllers/amistadesController.js';
import { protegido } from '../middlewares/auth.js';

const router = Router();

router.get('/', protegido, listarAmigos);
router.get('/solicitudes', protegido, listarSolicitudesPendientes);
router.post('/:id', protegido, enviarSolicitud);
router.patch('/:id/aceptar', protegido, aceptarSolicitud);
router.delete('/:id', protegido, eliminarAmistad);

export default router;
