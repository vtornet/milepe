import crypto from 'node:crypto';
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Correos que no pueden volver a registrarse. Se apunta uno cuando alguien
// suspendido borra su cuenta: sin esto, borrarla (que anonimiza el correo)
// seria la forma de saltarse la suspension registrandose otra vez con el
// mismo. Dura lo mismo que la suspension que tenia.
//
// Se guarda el HASH del correo normalizado, no el correo: la cuenta se borro
// y guardar su direccion en claro contradiria el borrado. Para comprobar un
// registro basta con hashear el correo nuevo de la misma forma.
//
// Normalizar quita los trucos obvios para tener "otro" correo con el mismo
// buzon: mayusculas, el sufijo +algo y, en Gmail, los puntos.
export const normalizarCorreo = (email) => {
  const [usuario = '', dominio = ''] = String(email || '').trim().toLowerCase().split('@');
  let local = usuario.split('+')[0];
  const dom = dominio === 'googlemail.com' ? 'gmail.com' : dominio;
  if (dom === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${dom}`;
};

export const hashCorreo = (email) => crypto.createHash('sha256').update(normalizarCorreo(email)).digest('hex');

const correoBloqueadoSchema = new Schema(
  {
    email_hash: { type: String, required: true, unique: true },
    // Mismo criterio que Usuario.suspension.
    hasta: { type: Date, default: null },
    permanente: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

correoBloqueadoSchema.statics.bloquear = function bloquear(email, { hasta, permanente }) {
  return this.updateOne(
    { email_hash: hashCorreo(email) },
    { $set: { hasta: hasta || null, permanente: Boolean(permanente) } },
    { upsert: true },
  );
};

correoBloqueadoSchema.statics.estaBloqueado = async function estaBloqueado(email, ahora = new Date()) {
  if (!email) return false;
  const fila = await this.findOne({ email_hash: hashCorreo(email) });
  return Boolean(fila && (fila.permanente || (fila.hasta && fila.hasta > ahora)));
};

export default model('CorreoBloqueado', correoBloqueadoSchema);
