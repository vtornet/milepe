import { Router } from 'express';
import { configuracionPagos, crearCheckout, obtenerPago, listarMisPagos } from '../controllers/pagosController.js';
import { protegido } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

// El webhook NO esta aqui: necesita el cuerpo crudo y va montado en app.js
// antes de express.json.
const router = Router();

router.get('/config', configuracionPagos);
router.get('/mios', protegido, listarMisPagos);
router.post('/checkout', protegido, exigePerfilCompleto, crearCheckout);
router.get('/:id', protegido, obtenerPago);

export default router;
