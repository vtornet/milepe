import mongoose from 'mongoose';

/**
 * Conecta con MongoDB (Railway) usando Mongoose.
 * Se llama una unica vez desde server.js al arrancar.
 */
const conectarDB = async () => {
  // Railway nombra la variable de forma distinta segun la plantilla que uses
  // para provisionar Mongo (MONGO_URL en la plantilla "Mongo" clasica,
  // MONGODB_URL en otras). Aceptamos las tres para no obligar a renombrar
  // nada al copiar el valor que Railway te da.
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.MONGO_URL;

  if (!uri) {
    throw new Error('Falta la URI de conexion a MongoDB (MONGODB_URI, MONGODB_URL o MONGO_URL) en las variables de entorno');
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
