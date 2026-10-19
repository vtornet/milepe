import { Router } from 'express';
import { obtenerTiempo } from '../controllers/tiempoController.js';

const router = Router();

// Publico y sin :id: El Tiempo no tiene contenido de usuario, es una sola
// consulta para todo el pueblo.
router.get('/', obtenerTiempo);

export default router;
