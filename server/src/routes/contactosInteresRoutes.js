import { Router } from 'express';
import {
  listarContactos,
  listarTodosLosContactos,
  crearContacto,
  actualizarContacto,
  eliminarContacto,
} from '../controllers/contactosInteresController.js';
import { protegido, autorizar } from '../middlewares/auth.js';

const router = Router();

// /todos va antes que cualquier ruta con :id (aunque hoy no haya ninguna
// GET /:id, dejarlo arriba evita que una futura la capture por error).
router.get('/todos', protegido, autorizar('admin'), listarTodosLosContactos);
router.get('/', listarContactos);
router.post('/', protegido, autorizar('admin'), crearContacto);
router.patch('/:id', protegido, autorizar('admin'), actualizarContacto);
router.delete('/:id', protegido, autorizar('admin'), eliminarContacto);

export default router;
