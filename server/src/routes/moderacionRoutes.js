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
  asignarReporte,
  asignarApelacion,
  listarNotas,
  crearNota,
} from '../controllers/moderacionController.js';
import { protegido, autorizar } from '../middlewares/auth.js';
import { exigePerfilCompleto } from '../middlewares/perfil.js';

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
// Reportar es escribir: exige correo verificado y perfil completo, como
// /posts/:id/reportar (que llega aqui mismo). Sin esto, una cuenta recien
// creada sin verificar podia reportar desde esta ruta.
router.post('/reportes', protegido, exigePerfilCompleto, crearReporte);
router.get('/mi-contenido-moderado', protegido, listarMiContenidoModerado);
router.post('/apelaciones', protegido, crearApelacion);

// Equipo de moderacion
router.get('/resumen', protegido, equipo, resumenPendientes);
router.get('/reportes', protegido, equipo, listarReportes);
router.patch('/reportes/:id', protegido, equipo, resolverReporte);
router.patch('/reportes/:id/asignacion', protegido, equipo, asignarReporte);
router.get('/notas', protegido, equipo, listarNotas);
router.post('/notas', protegido, equipo, crearNota);
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
router.patch('/apelaciones/:id/asignacion', protegido, soloAdmin, asignarApelacion);

export default router;
