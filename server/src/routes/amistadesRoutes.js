import { Router } from 'express';
import {
  enviarSolicitud,
  aceptarSolicitud,
  eliminarAmistad,
  listarAmigos,
  listarSolicitudesPendientes,
} from '../controllers/amistadesController.js';
import { protegido } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

router.get('/', protegido, listarAmigos);
router.get('/solicitudes', protegido, listarSolicitudesPendientes);
router.post('/:id', protegido, exigePerfilCompleto, enviarSolicitud);
router.patch('/:id/aceptar', protegido, exigePerfilCompleto, aceptarSolicitud);
router.delete('/:id', protegido, exigePerfilCompleto, eliminarAmistad);

export default router;
