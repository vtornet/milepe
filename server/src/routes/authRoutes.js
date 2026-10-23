import { Router } from 'express';
import {
  registrar,
  iniciarSesion,
  entrarConGoogle,
  solicitarRecuperacion,
  restablecerContraseña,
  verificarCorreo,
  reenviarVerificacion,
  perfil,
} from '../controllers/authController.js';
import { protegido } from '../middlewares/auth.js';
import { limiteAltas, limiteIntentosDeAcceso } from '../middlewares/limites.js';

const router = Router();

router.post('/registro', limiteAltas, registrar);
router.post('/login', limiteIntentosDeAcceso, iniciarSesion);
router.post('/google', limiteIntentosDeAcceso, entrarConGoogle);

// Las dos mitades de la recuperacion: pedir el enlace y usarlo. Publicas
// las dos, claro — quien ha perdido la contraseña no tiene sesion con la
// que autenticarse.
router.post('/recuperar', limiteAltas, solicitarRecuperacion);
router.post('/restablecer', limiteIntentosDeAcceso, restablecerContraseña);

// Verificacion del correo. /verificar es publica: el enlace se abre desde
// el correo, quiza en otro dispositivo sin sesion iniciada.
router.post('/verificar', limiteIntentosDeAcceso, verificarCorreo);
router.post('/reenviar-verificacion', protegido, limiteAltas, reenviarVerificacion);

router.get('/perfil', protegido, perfil);

export default router;
