import { Router } from 'express';
import { buscar } from '../controllers/buscarController.js';
import { opcional } from '../middlewares/auth.js';

const router = Router();

// Publico; con sesion añade vecinos.
router.get('/', opcional, buscar);

export default router;
