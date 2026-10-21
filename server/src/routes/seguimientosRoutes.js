import { Router } from 'express';
import {
  seguir,
  dejarDeSeguir,
  listarSeguidos,
  listarSeguidores,
  estadoCon,
} from '../controllers/seguimientosController.js';
import { protegido } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

const router = Router();

// Las dos listas van antes de /:id para que "siguiendo" y "seguidores" no
// se tomen por el id de un vecino.
router.get('/siguiendo', protegido, listarSeguidos);
router.get('/seguidores', protegido, listarSeguidores);
router.get('/estado/:id', protegido, estadoCon);

// :id es siempre el id del OTRO vecino, nunca el de la fila de
// seguimiento: el cliente sabe a quién quiere seguir, no tiene por qué
// conocer el id de un documento intermedio. Mismo criterio que
// /api/usuarios/:id/bloquear.
router.post('/:id', protegido, exigePerfilCompleto, seguir);
router.delete('/:id', protegido, exigePerfilCompleto, dejarDeSeguir);

export default router;
