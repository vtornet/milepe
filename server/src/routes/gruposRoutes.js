import { Router } from 'express';
import {
  listarGrupos,
  listarMisGrupos,
  obtenerGrupo,
  crearGrupo,
  actualizarGrupo,
  unirseAGrupo,
  salirDeGrupo,
  listarPublicacionesDeGrupo,
  publicarEnGrupo,
} from '../controllers/gruposController.js';
import { protegido, opcional } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

// /mios va antes que /:id, o Express lo leeria como un id.
router.get('/', listarGrupos);
router.get('/mios', protegido, listarMisGrupos);
router.get('/:id', opcional, obtenerGrupo);
router.post('/', protegido, exigePerfilCompleto, crearGrupo);
router.patch('/:id', protegido, exigePerfilCompleto, actualizarGrupo);
router.post('/:id/miembros', protegido, exigePerfilCompleto, unirseAGrupo);
// Salir no exige el perfil completo: irse tiene que poder hacerse siempre.
router.delete('/:id/miembros', protegido, salirDeGrupo);
router.get('/:id/publicaciones', opcional, listarPublicacionesDeGrupo);
router.post('/:id/publicaciones', protegido, exigePerfilCompleto, publicarEnGrupo);

export default router;
