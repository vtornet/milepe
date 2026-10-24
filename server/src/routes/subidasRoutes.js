import { Router } from 'express';
import { subirImagenes, subirAvatar } from '../controllers/subidasController.js';
import { protegido } from '../middlewares/auth.js';
import { exigePerfilCompleto, exigeEmailVerificado } from '../middlewares/perfil.js';
import upload from '../middlewares/upload.js';
import { limiteSubidas } from '../middlewares/limites.js';

const router = Router();

router.post('/imagenes', protegido, limiteSubidas, exigePerfilCompleto, upload.array('imagenes', 5), subirImagenes);
// La foto de perfil: basta el correo verificado, porque la foto es parte de
// lo que completa el perfil (con exigePerfilCompleto nadie podia completarlo).
router.post('/avatar', protegido, limiteSubidas, exigeEmailVerificado, upload.single('imagen'), subirAvatar);

export default router;
