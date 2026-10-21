import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Seguir a un vecino. Sustituye a Amistad, que era una solicitud con su
// estado 'pendiente' y su aceptacion.
//
// La diferencia que importa: seguir es unilateral y no se aprueba. Eso es
// lo que permite que "os seguis mutuamente" sea un estado DERIVADO -dos
// documentos, uno en cada sentido- en vez de un campo que alguien tenga
// que mantener al dia. Y es justo lo que mira la puerta de los mensajes
// privados: se escriben los dos o no se escribe ninguno.
//
// Con Amistad habia que preguntarle al controlador en que sentido se
// habia creado la fila para saber si dos personas estaban relacionadas;
// aqui cada sentido es su propia fila y no hay nada que interpretar.
const seguimientoSchema = new Schema(
  {
    seguidor_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    seguido_id: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

seguimientoSchema.pre('validate', function comprobarNoSeguirseASiMismo(next) {
  if (this.seguidor_id && this.seguido_id && this.seguidor_id.equals(this.seguido_id)) {
    this.invalidate('seguido_id', 'No puedes seguirte a ti mismo');
  }
  next();
});

// Un documento por SENTIDO. A->B y B->A son dos cosas distintas y las dos
// pueden convivir: eso es exactamente seguirse mutuamente. Por eso el
// unico unico es el del par ordenado, al contrario que en Amistad, donde
// el controlador tenia que comprobar a mano el sentido inverso para que no
// acabasen dos filas describiendo la misma relacion.
seguimientoSchema.index({ seguidor_id: 1, seguido_id: 1 }, { unique: true });
// Las dos listas de un perfil: "a quien sigue" y "quien le sigue".
seguimientoSchema.index({ seguidor_id: 1, fecha_creacion: -1 });
seguimientoSchema.index({ seguido_id: 1, fecha_creacion: -1 });

// No hay contadores desnormalizados en Usuario (num_seguidores y
// compania) a proposito: contar con estos indices es una consulta barata,
// y un contador desnormalizado solo se paga cuando hace falta en cada fila
// de un listado, que no es el caso. Si algun dia el muro tiene que
// ensenar "1.2k seguidores" por tarjeta, ese sera el momento.

seguimientoSchema.statics.sigue = function sigue(seguidorId, seguidoId) {
  return this.exists({ seguidor_id: seguidorId, seguido_id: seguidoId });
};

// El estado completo entre dos personas en UNA consulta: si le sigo, si me
// sigue y si por tanto nos seguimos. Una sola consulta y no dos porque las
// tres preguntas se hacen siempre juntas -el boton de seguir y el de
// escribir se pintan a la vez- y dos viajes para lo mismo es un viaje de
// mas.
seguimientoSchema.statics.estadoEntre = async function estadoEntre(usuarioId, otroId) {
  const filas = await this.find({
    $or: [
      { seguidor_id: usuarioId, seguido_id: otroId },
      { seguidor_id: otroId, seguido_id: usuarioId },
    ],
  }).select('seguidor_id');

  const sigo = filas.some((fila) => String(fila.seguidor_id) === String(usuarioId));
  const me_sigue = filas.some((fila) => String(fila.seguidor_id) === String(otroId));

  return { sigo, me_sigue, mutuo: sigo && me_sigue };
};

seguimientoSchema.statics.seSiguenMutuamente = async function seSiguenMutuamente(unoId, otroId) {
  const { mutuo } = await this.estadoEntre(unoId, otroId);
  return mutuo;
};

// Rompe el seguimiento en los dos sentidos. Lo usa el bloqueo: bloquear a
// alguien y seguir apareciendo en su lista de seguidores -y por tanto
// manteniendole el canal de mensajes abierto- seria no haber bloqueado
// nada.
seguimientoSchema.statics.romperEnAmbosSentidos = function romperEnAmbosSentidos(unoId, otroId) {
  return this.deleteMany({
    $or: [
      { seguidor_id: unoId, seguido_id: otroId },
      { seguidor_id: otroId, seguido_id: unoId },
    ],
  });
};

export default model('Seguimiento', seguimientoSchema);
