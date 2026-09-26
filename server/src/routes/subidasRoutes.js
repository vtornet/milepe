import { Router } from 'express';
import { subirImagenes } from '../controllers/subidasController.js';
import { protegido } from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';

const router = Router();

router.post('/imagenes', protegido, upload.array('imagenes', 5), subirImagenes);

export default router;
