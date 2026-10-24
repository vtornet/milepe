import { Router } from 'express';
import {
  crearAnuncio,
  listarAnuncios,
  obtenerAnuncio,
  cerrarAnuncio,
  renovarAnuncio,
} from '../controllers/anunciosController.js';
import { protegido } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

router.get('/', listarAnuncios);
router.get('/:id', obtenerAnuncio);
router.post('/', protegido, exigePerfilCompleto, crearAnuncio);
// Solo el autor (lo comprueba el controlador).
router.patch('/:id/cerrar', protegido, exigePerfilCompleto, cerrarAnuncio);
router.patch('/:id/renovar', protegido, exigePerfilCompleto, renovarAnuncio);

export default router;
