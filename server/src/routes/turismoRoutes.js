import { Router } from 'express';
import {
  resumenSecciones,
  listarTurismo,
  listarTodosLosRecursos,
  obtenerTurismo,
  crearRecurso,
  actualizarRecurso,
  eliminarRecurso,
} from '../controllers/turismoController.js';
import { protegido, autorizar } from '../middlewares/auth.js';

const router = Router();

// /secciones y /todos van antes que /:id, o Express los leeria como un id.
router.get('/secciones', resumenSecciones);
router.get('/todos', protegido, autorizar('admin'), listarTodosLosRecursos);
router.get('/', listarTurismo);
router.get('/:id', obtenerTurismo);
router.post('/', protegido, autorizar('admin'), crearRecurso);
router.patch('/:id', protegido, autorizar('admin'), actualizarRecurso);
router.delete('/:id', protegido, autorizar('admin'), eliminarRecurso);

export default router;
