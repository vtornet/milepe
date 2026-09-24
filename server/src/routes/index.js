import { Router } from 'express';

const router = Router();

// Salud del servicio (usado por Railway/monitorizacion)
router.get('/health', (req, res) => {
  res.json({ ok: true, servicio: 'milepe-api' });
});

// A medida que se implementen los modelos y controladores de cada seccion,
// sus routers se importan y montan aqui. Un router por seccion mantiene
// el feed general (posts) desacoplado de los detalles de cada tipo.
//
// router.use('/auth', authRoutes);
// router.use('/posts', postsRoutes);          // muro (feed general)
// router.use('/quejas', quejasRoutes);
// router.use('/turismo', turismoRoutes);
// router.use('/fotos', fotosRoutes);
// router.use('/eventos', eventosRoutes);
// router.use('/tiempo', tiempoRoutes);
// router.use('/empleo', empleoRoutes);
// router.use('/negocios', negociosRoutes);
// router.use('/contactos', contactosRoutes);
// router.use('/pagos', pagosRoutes);          // Stripe (checkout + webhook)

export default router;
