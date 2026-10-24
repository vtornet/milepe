import { Router } from 'express';
import {
  crearEvento,
  listarEventos,
  obtenerEvento,
  alternarAsistencia,
  misAsistencias,
  calendarioEvento,
} from '../controllers/eventosController.js';
import { protegido } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

router.get('/', listarEventos);
// Antes de /:id, o Express leeria "mis-asistencias" como un id.
router.get('/mis-asistencias', protegido, misAsistencias);
router.get('/:id', obtenerEvento);
router.get('/:id/calendario.ics', calendarioEvento);
router.post('/', protegido, exigePerfilCompleto, crearEvento);
router.post('/:id/asistir', protegido, exigePerfilCompleto, alternarAsistencia);

export default router;
