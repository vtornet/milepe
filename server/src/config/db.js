import mongoose from 'mongoose';

/**
 * Conecta con MongoDB (Railway) usando Mongoose.
 * Se llama una unica vez desde server.js al arrancar.
 */
const conectarDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('Falta MONGODB_URI en las variables de entorno');
  }

  mongoose.connection.on('connected', () => {
    console.log('[db] Conectado a MongoDB');
  });

  mongoose.connection.on('error', (error) => {
    console.error('[db] Error de conexion a MongoDB:', error.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] Desconectado de MongoDB');
  });

  await mongoose.connect(uri);
};

export default conectarDB;
