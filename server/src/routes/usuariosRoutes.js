import { Router } from 'express';
import {
  bloquearUsuario,
  desbloquearUsuario,
  listarBloqueados,
  buscarUsuarios,
  miPerfil,
  actualizarMiPerfil,
  perfilPublico,
  marcarOficial,
  cambiarRol,
  listarUsuariosAdmin,
  suspenderUsuario,
  levantarSuspension,
  exportarMisDatos,
  eliminarMiCuenta,
} from '../controllers/usuariosController.js';
import { protegido, opcional, autorizar } from '../middlewares/auth.js';
import { marcarVerificado } from '../controllers/verificacionController.js';

const router = Router();

// El perfil propio va antes que /:id/... para que "perfil" no se tome por
// un id de usuario.
router.get('/perfil', protegido, miPerfil);
router.put('/perfil', protegido, actualizarMiPerfil);
// RGPD: descargar mis datos y eliminar mi cuenta.
router.get('/perfil/exportar', protegido, exportarMisDatos);
router.delete('/perfil', protegido, eliminarMiCuenta);

router.get('/buscar', protegido, buscarUsuarios);
router.get('/bloqueados', protegido, listarBloqueados);
// Panel de usuarios del admin (con datos privados). Antes de /:id.
router.get('/admin', protegido, autorizar('admin'), listarUsuariosAdmin);
// La ficha de un vecino se ve sin sesion (MiLepe se lee sin cuenta), pero
// si hay sesion la respuesta incluye la relacion: de ahi `opcional` y no
// `protegido`. Va despues de /perfil, /buscar y /bloqueados para que esas
// tres no se tomen por el id de un usuario.
router.get('/:id', opcional, perfilPublico);

router.patch('/:id/oficial', protegido, autorizar('admin'), marcarOficial);
router.patch('/:id/verificado', protegido, autorizar('admin'), marcarVerificado);
router.patch('/:id/rol', protegido, autorizar('admin'), cambiarRol);
router.put('/:id/suspension', protegido, autorizar('admin'), suspenderUsuario);
router.delete('/:id/suspension', protegido, autorizar('admin'), levantarSuspension);
router.post('/:id/bloquear', protegido, bloquearUsuario);
router.delete('/:id/bloquear', protegido, desbloquearUsuario);

export default router;
