import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const { Schema, model } = mongoose;

// Roles soportados desde el dia 1, aunque de momento solo exista un admin.
// Anadir un moderador nuevo en el futuro es tan simple como cambiar este
// campo en un documento existente: no hace falta migrar nada.
export const ROLES_USUARIO = ['usuario', 'moderador', 'admin'];

const usuarioSchema = new Schema(
  {
    nombre_usuario: {
      type: String,
      required: [true, 'El nombre de usuario es obligatorio'],
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[a-zA-Z0-9._-]+$/, 'El nombre de usuario solo puede contener letras, numeros, puntos, guiones y guiones bajos'],
    },
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      maxlength: 60,
    },
    email: {
      type: String,
      required: [true, 'El email es obligatorio'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'El email no es valido'],
    },
    contraseña: {
      type: String,
      required: [true, 'La contraseña es obligatoria'],
      minlength: 8,
      // Nunca se devuelve en una consulta salvo que se pida explicitamente
      // con .select('+contraseña') (login).
      select: false,
    },
    avatar_url: {
      type: String,
      default: null,
    },
    rol: {
      type: String,
      enum: ROLES_USUARIO,
      default: 'usuario',
    },
    email_verificado: {
      type: Boolean,
      default: false,
    },
    // Permite banear/desactivar una cuenta sin borrar sus datos ni romper
    // las referencias (posts, comentarios) que la citan por autor_id.
    activo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// Hashea la contraseña solo cuando se crea el usuario o cuando se modifica
// (evita volver a hashear un hash ya guardado en cada .save()).
usuarioSchema.pre('save', async function hashearContraseña(next) {
  if (!this.isModified('contraseña')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.contraseña = await bcrypt.hash(this.contraseña, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compara una contraseña en texto plano (login) con el hash guardado.
// El documento debe haberse consultado con .select('+contraseña').
usuarioSchema.methods.compararContraseña = function compararContraseña(candidata) {
  if (!this.contraseña) {
    throw new Error('El documento no incluye el hash de la contraseña; usa .select("+contraseña") al consultarlo');
  }
  return bcrypt.compare(candidata, this.contraseña);
};

// select: false ya deberia bastar, pero esto blinda cualquier respuesta
// JSON aunque alguien haga un .select('+contraseña') y se olvide de quitarla.
usuarioSchema.methods.toJSON = function toJSON() {
  const objeto = this.toObject();
  delete objeto.contraseña;
  return objeto;
};

usuarioSchema.index({ rol: 1 });

export default model('Usuario', usuarioSchema);
