import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Solicitud de amistad entre dos vecinos. 'pendiente' hasta que el
// receptor responde; se borra el documento entero si la rechaza (no queda
// un estado 'rechazada' colgado para siempre) y se queda en 'aceptada' si
// la acepta.
export const ESTADOS_AMISTAD = ['pendiente', 'aceptada'];

const amistadSchema = new Schema(
  {
    solicitante_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    receptor_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    estado: {
      type: String,
      enum: ESTADOS_AMISTAD,
      default: 'pendiente',
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

amistadSchema.pre('validate', function comprobarNoAutosolicitud(next) {
  if (this.solicitante_id && this.receptor_id && this.solicitante_id.equals(this.receptor_id)) {
    this.invalidate('receptor_id', 'No puedes enviarte una solicitud a ti mismo');
  }
  next();
});

// Una sola solicitud/amistad por par de usuarios, en el sentido en que se
// creo. El controlador es quien comprueba tambien el sentido inverso antes
// de crear (ver Amistad.existeEntre) para que A->B y B->A no convivan como
// dos documentos distintos.
amistadSchema.index({ solicitante_id: 1, receptor_id: 1 }, { unique: true });
// "Mis solicitudes recibidas pendientes", "con quien soy amigo ya".
amistadSchema.index({ receptor_id: 1, estado: 1 });
amistadSchema.index({ solicitante_id: 1, estado: 1 });

// Busca una amistad/solicitud entre dos usuarios sin que importe quien la
// envio originalmente.
amistadSchema.statics.existeEntre = function existeEntre(usuarioIdA, usuarioIdB) {
  return this.findOne({
    $or: [
      { solicitante_id: usuarioIdA, receptor_id: usuarioIdB },
      { solicitante_id: usuarioIdB, receptor_id: usuarioIdA },
    ],
  });
};

export default model('Amistad', amistadSchema);
