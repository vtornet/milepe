import { Router } from 'express';
import { subirImagenes } from '../controllers/subidasController.js';
import { protegido } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';
import upload from '../middlewares/upload.js';

const router = Router();

router.post('/imagenes', protegido, exigePerfilCompleto, upload.array('imagenes', 5), subirImagenes);

export default router;
