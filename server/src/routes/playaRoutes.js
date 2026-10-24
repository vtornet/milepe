import { Router } from 'express';
import { obtenerPlaya } from '../controllers/playaController.js';

const router = Router();

router.get('/', obtenerPlaya);

export default router;
