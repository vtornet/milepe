import { Router } from 'express';
import { configuracionPagos, crearCheckout, obtenerPago, listarMisPagos, listarPagosAdmin } from '../controllers/pagosController.js';
import { protegido, autorizar } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

// El webhook NO esta aqui: necesita el cuerpo crudo y va montado en app.js
// antes de express.json.
const router = Router();

router.get('/config', configuracionPagos);
router.get('/mios', protegido, listarMisPagos);
// Antes que /:id. Solo admin: son ingresos de la red.
router.get('/admin', protegido, autorizar('admin'), listarPagosAdmin);
router.post('/checkout', protegido, exigePerfilCompleto, crearCheckout);
router.get('/:id', protegido, obtenerPago);

export default router;
