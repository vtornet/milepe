import { Router } from 'express';
import { crearEncuesta, listarEncuestas, obtenerEncuesta, misVotos, votar } from '../controllers/encuestasController.js';
import { protegido, opcional } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

// Con opcional: a quien la publico se le enseñan los resultados.
router.get('/', opcional, listarEncuestas);
// Antes de /:id, o Express leeria "mis-votos" como un id.
router.get('/mis-votos', protegido, misVotos);
router.get('/:id', opcional, obtenerEncuesta);
router.post('/', protegido, exigePerfilCompleto, crearEncuesta);
router.post('/:id/votar', protegido, exigePerfilCompleto, votar);

export default router;
