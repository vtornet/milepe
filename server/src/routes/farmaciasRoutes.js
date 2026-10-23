import { Router } from 'express';
import {
  listarFarmacias,
  listarTodasLasFarmacias,
  crearFarmacia,
  actualizarFarmacia,
  eliminarFarmacia,
  guardiaActual,
  listarGuardiasDelMes,
  guardarGuardiasDelMes,
  vaciarGuardiasDelMes,
} from '../controllers/farmaciasController.js';
import { protegido, autorizar } from '../middlewares/auth.js';

const router = Router();

// Lo estatico antes que /:id, o Express leeria "guardia" como un id.
router.get('/guardia', guardiaActual);
router.get('/guardias', listarGuardiasDelMes);
router.put('/guardias/:mes', protegido, autorizar('admin'), guardarGuardiasDelMes);
router.delete('/guardias/:mes', protegido, autorizar('admin'), vaciarGuardiasDelMes);

router.get('/todas', protegido, autorizar('admin'), listarTodasLasFarmacias);
router.get('/', listarFarmacias);
router.post('/', protegido, autorizar('admin'), crearFarmacia);
router.patch('/:id', protegido, autorizar('admin'), actualizarFarmacia);
router.delete('/:id', protegido, autorizar('admin'), eliminarFarmacia);

export default router;
