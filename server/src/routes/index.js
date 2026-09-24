import { Router } from 'express';
import authRoutes from './authRoutes.js';
import postsRoutes from './postsRoutes.js';
import quejasRoutes from './quejasRoutes.js';

const router = Router();

// Salud del servicio (usado por Railway/monitorizacion)
router.get('/health', (req, res) => {
  res.json({ ok: true, servicio: 'milepe-api' });
});

router.use('/auth', authRoutes);
router.use('/posts', postsRoutes); // muro (feed general) + like/reportar/comentarios/moderar, comunes a toda seccion
router.use('/quejas', quejasRoutes);

// A medida que se implementen los modelos y controladores de cada seccion,
// sus routers se importan y montan aqui.
//
// router.use('/turismo', turismoRoutes);
// router.use('/fotos', fotosRoutes);
// router.use('/eventos', eventosRoutes);
// router.use('/tiempo', tiempoRoutes);
// router.use('/empleo', empleoRoutes);
// router.use('/negocios', negociosRoutes);
// router.use('/contactos', contactosRoutes);
// router.use('/pagos', pagosRoutes);          // Stripe (checkout + webhook)

export default router;
