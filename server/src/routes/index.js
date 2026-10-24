import { Router } from 'express';
import authRoutes from './authRoutes.js';
import postsRoutes from './postsRoutes.js';
import quejasRoutes from './quejasRoutes.js';
import usuariosRoutes from './usuariosRoutes.js';
import seguimientosRoutes from './seguimientosRoutes.js';
import notificacionesRoutes from './notificacionesRoutes.js';
import conversacionesRoutes from './conversacionesRoutes.js';
import moderacionRoutes from './moderacionRoutes.js';
import subidasRoutes from './subidasRoutes.js';
import fotosRoutes from './fotosRoutes.js';
import eventosRoutes from './eventosRoutes.js';
import negociosRoutes from './negociosRoutes.js';
import turismoRoutes from './turismoRoutes.js';
import empleoRoutes from './empleoRoutes.js';
import contactosInteresRoutes from './contactosInteresRoutes.js';
import tiempoRoutes from './tiempoRoutes.js';
import estadisticasRoutes from './estadisticasRoutes.js';
import farmaciasRoutes from './farmaciasRoutes.js';
import avisosRoutes from './avisosRoutes.js';

const router = Router();

// Salud del servicio (usado por Railway/monitorizacion)
router.get('/health', (req, res) => {
  res.json({ ok: true, servicio: 'milepe-api' });
});

router.use('/auth', authRoutes);
router.use('/posts', postsRoutes); // muro (feed general) + reaccion/reportar/comentarios/moderar, comunes a toda seccion
router.use('/quejas', quejasRoutes);
router.use('/usuarios', usuariosRoutes); // bloqueos por ahora; perfil publico mas adelante
router.use('/seguimientos', seguimientosRoutes); // sustituye a /amistades: seguir es unilateral y no se aprueba
router.use('/notificaciones', notificacionesRoutes);
router.use('/conversaciones', conversacionesRoutes); // mensajeria privada; la unica seccion sin nada publico
router.use('/moderacion', moderacionRoutes); // reportes, acciones, apelaciones y auditoria (vale para post y comentario)
router.use('/subidas', subidasRoutes); // generico: cualquier seccion sube imagenes por aqui antes de crear su post
router.use('/fotos', fotosRoutes);
router.use('/eventos', eventosRoutes);
router.use('/negocios', negociosRoutes);
router.use('/turismo', turismoRoutes);
router.use('/empleo', empleoRoutes);
router.use('/contactos-interes', contactosInteresRoutes); // ficha estatica (no es un Post), gestionada por admin
router.use('/tiempo', tiempoRoutes); // proxy cacheado a OpenWeather; no toca Mongo
router.use('/avisos', avisosRoutes); // avisos oficiales: solo los publica una cuenta oficial o un admin
router.use('/farmacias', farmaciasRoutes); // directorio + calendario de guardias; lo mantiene un admin, no hay API oficial de la que leerlo
router.use('/estadisticas', estadisticasRoutes); // panel de admin: recuentos y agregados de toda la red

// A medida que se implementen los modelos y controladores de cada seccion,
// sus routers se importan y montan aqui.
//
// router.use('/pagos', pagosRoutes);          // Stripe (checkout + webhook)

export default router;
