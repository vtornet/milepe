import { Router } from 'express';
import { configuracionPagos, crearCheckout, obtenerPago, listarMisPagos, listarPagosAdmin } from '../controllers/pagosController.js';
import { protegido, autorizar } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';
import { miVerificacion, suscribirse, darseDeBaja, reactivar } from '../controllers/verificacionController.js';

// El webhook NO esta aqui: necesita el cuerpo crudo y va montado en app.js
// antes de express.json.
const router = Router();

router.get('/config', configuracionPagos);
router.get('/mios', protegido, listarMisPagos);
// Antes que /:id. Solo admin: son ingresos de la red.
router.get('/admin', protegido, autorizar('admin'), listarPagosAdmin);
router.post('/checkout', protegido, exigePerfilCompleto, crearCheckout);
// Perfil verificado (suscripcion mensual). Antes que /:id.
router.get('/verificacion', protegido, miVerificacion);
router.post('/verificacion', protegido, exigePerfilCompleto, suscribirse);
router.post('/verificacion/baja', protegido, darseDeBaja);
router.post('/verificacion/reactivar', protegido, reactivar);
router.get('/:id', protegido, obtenerPago);

export default router;
