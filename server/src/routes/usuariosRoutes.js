import { Router } from 'express';
import {
  bloquearUsuario,
  desbloquearUsuario,
  listarBloqueados,
  buscarUsuarios,
  miPerfil,
  actualizarMiPerfil,
} from '../controllers/usuariosController.js';
import { protegido } from '../middlewares/auth.js';

const router = Router();

// El perfil propio va antes que /:id/... para que "perfil" no se tome por
// un id de usuario.
router.get('/perfil', protegido, miPerfil);
router.put('/perfil', protegido, actualizarMiPerfil);

router.get('/buscar', protegido, buscarUsuarios);
router.get('/bloqueados', protegido, listarBloqueados);
router.post('/:id/bloquear', protegido, bloquearUsuario);
router.delete('/:id/bloquear', protegido, desbloquearUsuario);

export default router;
