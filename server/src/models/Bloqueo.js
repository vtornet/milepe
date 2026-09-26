import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const bloqueoSchema = new Schema(
  {
    bloqueador_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    bloqueado_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

bloqueoSchema.pre('validate', function comprobarNoAutobloqueo(next) {
  if (this.bloqueador_id && this.bloqueado_id && this.bloqueador_id.equals(this.bloqueado_id)) {
    this.invalidate('bloqueado_id', 'No puedes bloquearte a ti mismo');
  }
  next();
});

// Un usuario solo puede bloquear a otro una vez (volver a intentarlo es un
// 409 desde el controlador, no un segundo documento).
bloqueoSchema.index({ bloqueador_id: 1, bloqueado_id: 1 }, { unique: true });
// "¿A quien tengo bloqueado?" y "¿quien me tiene bloqueado a mi?".
bloqueoSchema.index({ bloqueado_id: 1 });

// True si hay bloqueo en cualquiera de los dos sentidos entre dos usuarios.
// Es la comprobacion que hace falta antes de dejar comentar/mensajear: en
// un pueblo pequeño un bloqueo casi siempre debe ser mutuo de cara a la
// interaccion, aunque cada uno vea su propia lista de bloqueados por
// separado (self.obtenerBloqueados no usa esto).
bloqueoSchema.statics.existeEntre = async function existeEntre(usuarioIdA, usuarioIdB) {
  const bloqueo = await this.findOne({
    $or: [
      { bloqueador_id: usuarioIdA, bloqueado_id: usuarioIdB },
      { bloqueador_id: usuarioIdB, bloqueado_id: usuarioIdA },
    ],
  });
  return Boolean(bloqueo);
};

export default model('Bloqueo', bloqueoSchema);
