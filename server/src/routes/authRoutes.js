import { Router } from 'express';
import { registrar, iniciarSesion, perfil } from '../controllers/authController.js';
import { protegido } from '../middlewares/auth.js';

const router = Router();

router.post('/registro', registrar);
router.post('/login', iniciarSesion);
router.get('/perfil', protegido, perfil);

export default router;
