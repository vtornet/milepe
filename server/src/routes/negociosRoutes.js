import { Router } from 'express';
import {
  crearNegocio,
  listarNegocios,
  obtenerNegocio,
  editarFicha,
  guardarOferta,
  reclamarNegocio,
  listarReclamaciones,
  listarMisReclamaciones,
  resolverReclamacion,
} from '../controllers/negociosController.js';
import { protegido, autorizar } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

router.get('/', listarNegocios);
// Antes de /:id, o Express leeria "reclamaciones" como un id.
router.get('/reclamaciones', protegido, autorizar('admin'), listarReclamaciones);
router.get('/mis-reclamaciones', protegido, listarMisReclamaciones);
router.patch('/reclamaciones/:id', protegido, autorizar('admin'), resolverReclamacion);
router.get('/:id', obtenerNegocio);
router.post('/', protegido, exigePerfilCompleto, crearNegocio);
// Gestion de la ficha: propietario, autor si nadie la ha reclamado, o admin
// (lo comprueba el controlador).
router.patch('/:id/ficha', protegido, exigePerfilCompleto, editarFicha);
router.put('/:id/oferta', protegido, exigePerfilCompleto, guardarOferta);
router.post('/:id/reclamar', protegido, exigePerfilCompleto, reclamarNegocio);

export default router;
