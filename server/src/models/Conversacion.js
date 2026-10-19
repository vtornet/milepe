import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Mensajeria privada entre dos vecinos. Deliberadamente 1 a 1, sin grupos:
// no se ha pedido, y asumir dos participantes simplifica todo (la clave de
// par, el "con quien hablo", el contador de no leidos). Si algun dia hacen
// falta grupos, clave_par dejaria de tener sentido y habria que repensarlo
// aposta, no estirarlo.
const ultimoMensajeSchema = new Schema(
  {
    texto: { type: String, required: true },
    autor_id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    fecha: { type: Date, required: true },
  },
  { _id: false },
);

const conversacionSchema = new Schema(
  {
    participantes: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Usuario' }],
      required: true,
    },
    // Los dos ids ordenados y unidos ("menor_mayor"). Existe solo para
    // poder ponerle un indice unico: con un array de participantes no hay
    // forma de que Mongo garantice "una sola conversacion por pareja", y
    // sin esa garantia dos clics simultaneos en "escribir a X" crean dos
    // conversaciones duplicadas que luego se ven como hilos distintos.
    clave_par: {
      type: String,
      required: true,
      unique: true,
    },
    // Desnormalizado para la lista de conversaciones: sin esto, pintar
    // "ultimo mensaje" de 20 hilos serian 20 consultas mas. Lo mantiene al
    // dia el hook de Mensaje.
    ultimo_mensaje: {
      type: ultimoMensajeSchema,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

conversacionSchema.pre('validate', function comprobarParticipantes(next) {
  const participantes = this.participantes || [];

  if (participantes.length !== 2) {
    this.invalidate('participantes', 'Una conversacion es entre exactamente dos personas');
    return next();
  }

  if (participantes[0].equals(participantes[1])) {
    this.invalidate('participantes', 'No puedes abrir una conversacion contigo mismo');
    return next();
  }

  this.clave_par = Conversacion.calcularClavePar(participantes[0], participantes[1]);
  next();
});

// "Mis conversaciones, la de actividad mas reciente primero".
conversacionSchema.index({ participantes: 1, fecha_actualizacion: -1 });

// La clave no depende del orden en que se pasen los dos usuarios: es el
// mismo hilo escriba quien escriba primero.
conversacionSchema.statics.calcularClavePar = (usuarioA, usuarioB) =>
  [String(usuarioA), String(usuarioB)].sort().join('_');

// Devuelve la conversacion entre dos usuarios, creandola si aun no
// existe. La carrera entre dos peticiones simultaneas la resuelve el
// indice unico: la segunda choca con E11000 y recupera la que acaba de
// crear la primera, en vez de duplicar.
conversacionSchema.statics.obtenerOCrear = async function obtenerOCrear(usuarioA, usuarioB) {
  const clave_par = this.calcularClavePar(usuarioA, usuarioB);

  const existente = await this.findOne({ clave_par });
  if (existente) return existente;

  try {
    return await this.create({ participantes: [usuarioA, usuarioB] });
  } catch (error) {
    if (error.code === 11000) return this.findOne({ clave_par });
    throw error;
  }
};

const Conversacion = model('Conversacion', conversacionSchema);

export default Conversacion;
