import { Router } from 'express';
import authRoutes from './authRoutes.js';
import postsRoutes from './postsRoutes.js';
import quejasRoutes from './quejasRoutes.js';
import usuariosRoutes from './usuariosRoutes.js';
import amistadesRoutes from './amistadesRoutes.js';
import notificacionesRoutes from './notificacionesRoutes.js';
import subidasRoutes from './subidasRoutes.js';
import fotosRoutes from './fotosRoutes.js';
import eventosRoutes from './eventosRoutes.js';
import negociosRoutes from './negociosRoutes.js';
import turismoRoutes from './turismoRoutes.js';

const router = Router();

// Salud del servicio (usado por Railway/monitorizacion)
router.get('/health', (req, res) => {
  res.json({ ok: true, servicio: 'milepe-api' });
});

router.use('/auth', authRoutes);
router.use('/posts', postsRoutes); // muro (feed general) + reaccion/reportar/comentarios/moderar, comunes a toda seccion
router.use('/quejas', quejasRoutes);
router.use('/usuarios', usuariosRoutes); // bloqueos por ahora; perfil publico mas adelante
router.use('/amistades', amistadesRoutes);
router.use('/notificaciones', notificacionesRoutes);
router.use('/subidas', subidasRoutes); // generico: cualquier seccion sube imagenes por aqui antes de crear su post
router.use('/fotos', fotosRoutes);
router.use('/eventos', eventosRoutes);
router.use('/negocios', negociosRoutes);
router.use('/turismo', turismoRoutes);

// A medida que se implementen los modelos y controladores de cada seccion,
// sus routers se importan y montan aqui.
//
// router.use('/tiempo', tiempoRoutes);
// router.use('/empleo', empleoRoutes);
// router.use('/contactos-interes', contactosInteresRoutes);
// router.use('/pagos', pagosRoutes);          // Stripe (checkout + webhook)

export default router;
