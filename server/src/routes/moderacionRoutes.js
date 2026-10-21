import { Router } from 'express';
import {
  crearReporte,
  listarReportes,
  resolverReporte,
  moderarContenido,
  listarMiContenidoModerado,
  crearApelacion,
  listarApelaciones,
  resolverApelacion,
  listarRegistro,
  resumenPendientes,
  listarEdicionesPendientes,
  aprobarEdicion,
  listarCatalogos,
} from '../controllers/moderacionController.js';
import { protegido, autorizar } from '../middlewares/auth.js';

const router = Router();

const equipo = autorizar('moderador', 'admin');
// Las apelaciones las resuelve solo un admin, no cualquier moderador: una
// apelacion es la revision de la decision de un moderador, asi que
// resolverla desde el mismo nivel la convertiria en un tramite. Ademas el
// controlador rechaza que alguien resuelva la apelacion contra su propia
// decision, aunque sea admin.
const soloAdmin = autorizar('admin');

router.get('/catalogos', listarCatalogos);

// Cualquier vecino con sesion
router.post('/reportes', protegido, crearReporte);
router.get('/mi-contenido-moderado', protegido, listarMiContenidoModerado);
router.post('/apelaciones', protegido, crearApelacion);

// Equipo de moderacion
router.get('/resumen', protegido, equipo, resumenPendientes);
router.get('/reportes', protegido, equipo, listarReportes);
router.patch('/reportes/:id', protegido, equipo, resolverReporte);
router.patch('/contenido', protegido, equipo, moderarContenido);
router.get('/registro', protegido, equipo, listarRegistro);

// Ediciones por revisar: la tercera cola, la unica en la que el contenido
// sigue viendose mientras espera. Para rechazar una edicion no hay ruta
// propia: es ocultar, y eso ya es PATCH /contenido.
router.get('/ediciones', protegido, equipo, listarEdicionesPendientes);
router.patch('/ediciones/:id', protegido, equipo, aprobarEdicion);

// Apelaciones: ver la cola la puede ver el equipo, resolverla solo admin.
router.get('/apelaciones', protegido, equipo, listarApelaciones);
router.patch('/apelaciones/:id', protegido, soloAdmin, resolverApelacion);

export default router;
