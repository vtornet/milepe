import { Router } from 'express';
import { subirImagenes } from '../controllers/subidasController.js';
import { protegido } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';
import upload from '../middlewares/upload.js';
import { limiteSubidas } from '../middlewares/limites.js';

const router = Router();

router.post('/imagenes', protegido, limiteSubidas, exigePerfilCompleto, upload.array('imagenes', 5), subirImagenes);

export default router;
