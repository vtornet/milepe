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

const router = Router();

router.post('/registro', registrar);
router.post('/login', iniciarSesion);
router.post('/google', entrarConGoogle);

// Las dos mitades de la recuperacion: pedir el enlace y usarlo. Publicas
// las dos, claro — quien ha perdido la contraseña no tiene sesion con la
// que autenticarse.
router.post('/recuperar', solicitarRecuperacion);
router.post('/restablecer', restablecerContraseña);

// Verificacion del correo. /verificar es publica: el enlace se abre desde
// el correo, quiza en otro dispositivo sin sesion iniciada.
router.post('/verificar', verificarCorreo);
router.post('/reenviar-verificacion', protegido, reenviarVerificacion);

router.get('/perfil', protegido, perfil);

export default router;
