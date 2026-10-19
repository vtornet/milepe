import { Router } from 'express';
import {
  listarConversaciones,
  abrirConversacion,
  listarMensajes,
  enviarMensaje,
  marcarLeida,
} from '../controllers/conversacionesController.js';
import { protegido } from '../middlewares/auth.js';

const router = Router();

// Toda la mensajeria exige sesion, sin excepcion: no hay nada publico aqui
// (es la unica seccion asi; las demas se leen sin iniciar sesion y solo
// tienen acciones concretas protegidas).
//
// Ojo al :id, que no significa lo mismo en todas las rutas: en /con/:id es
// el id del OTRO USUARIO (el cliente sabe con quien quiere hablar, no el id
// del hilo), y en el resto es el id de la CONVERSACION. De ahi el /con/,
// que esta precisamente para que la diferencia se vea en la URL en vez de
// tener dos clases de id indistinguibles en la misma posicion.
router.get('/', protegido, listarConversaciones);
router.post('/con/:id', protegido, abrirConversacion);
router.get('/:id/mensajes', protegido, listarMensajes);
router.post('/:id/mensajes', protegido, enviarMensaje);
router.patch('/:id/leida', protegido, marcarLeida);

export default router;
