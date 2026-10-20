import crypto from 'crypto';
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
    // Obligatoria solo si la cuenta NO viene de Google: quien entra con
    // Google no tiene contraseña en MiLepe y nunca la escribe. Es una
    // funcion y no `required: true` precisamente por eso.
    contraseña: {
      type: String,
      required: [
        function exigeContraseña() {
          return !this.google_id;
        },
        'La contraseña es obligatoria',
      ],
      minlength: 8,
      // Nunca se devuelve en una consulta salvo que se pida explicitamente
      // con .select('+contraseña') (login o restablecimiento).
      select: false,
    },
    // El identificador estable que da Google ('sub'). Se guarda en vez de
    // fiarse del email porque el email de una cuenta de Google puede
    // cambiar, y el sub no.
    //
    // La unicidad NO se declara aqui, sino abajo con un indice parcial.
    // Con `unique + sparse` no basta: sparse omite los documentos donde el
    // campo FALTA, pero `default: null` hace que el campo exista valiendo
    // null, asi que todas las cuentas con contraseña chocarian entre si por
    // compartir ese null. Lo descubrio la prueba de humo al crear la
    // segunda cuenta normal.
    google_id: {
      type: String,
      default: null,
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
    // Recuperacion de contraseña. Se guarda el HASH del token, no el token:
    // el que viaja por correo es el original, y si algun dia se filtrara la
    // base de datos, con estos hashes no se puede restablecer la contraseña
    // de nadie. Mismo principio que con la propia contraseña.
    token_recuperacion: {
      type: String,
      default: null,
      select: false,
    },
    token_recuperacion_expira: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// Cuanto vale un enlace de recuperacion. Una hora es el equilibrio
// habitual: suficiente para que alguien abra el correo con calma, poco
// para que un enlace olvidado en una bandeja siga sirviendo meses despues.
export const MINUTOS_VALIDEZ_RECUPERACION = 60;

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
// JSON aunque alguien pida un campo oculto con .select('+...') y se olvide
// de quitarlo antes de responder. El token de recuperacion es el mas
// peligroso de los cuatro: devolverlo en un JSON equivaldria a regalar el
// enlace de restablecimiento de esa cuenta.
const CAMPOS_NUNCA_SERIALIZADOS = ['contraseña', 'google_id', 'token_recuperacion', 'token_recuperacion_expira'];

usuarioSchema.methods.toJSON = function toJSON() {
  const objeto = this.toObject();
  for (const campo of CAMPOS_NUNCA_SERIALIZADOS) delete objeto[campo];
  return objeto;
};

// Genera un token de recuperacion: devuelve el ORIGINAL (el que va en el
// enlace del correo) y deja guardado su hash con su caducidad. No persiste:
// el controlador llama a save() despues.
//
// SHA-256 y no bcrypt a proposito: aqui el secreto son 32 bytes aleatorios,
// no una palabra que alguien pueda adivinar, asi que el coste de bcrypt no
// aporta nada y si ralentizaria cada intento.
usuarioSchema.methods.generarTokenRecuperacion = function generarTokenRecuperacion() {
  const original = crypto.randomBytes(32).toString('hex');

  this.token_recuperacion = crypto.createHash('sha256').update(original).digest('hex');
  this.token_recuperacion_expira = new Date(Date.now() + MINUTOS_VALIDEZ_RECUPERACION * 60 * 1000);

  return original;
};

// Busca al dueño de un token de recuperacion que siga vigente. Devuelve
// null tanto si el token no existe como si ya caduco: para quien lo usa,
// los dos casos son el mismo.
usuarioSchema.statics.porTokenRecuperacion = function porTokenRecuperacion(tokenOriginal) {
  const hash = crypto.createHash('sha256').update(tokenOriginal).digest('hex');

  return this.findOne({
    token_recuperacion: hash,
    token_recuperacion_expira: { $gt: new Date() },
  }).select('+contraseña +token_recuperacion +token_recuperacion_expira');
};

// Un google_id no puede repetirse, pero solo cuenta cuando existe de
// verdad: el filtro parcial deja fuera los null de las cuentas con
// contraseña. Mismo patron que los indices parciales de Reaccion y Mensaje.
usuarioSchema.index(
  { google_id: 1 },
  { unique: true, partialFilterExpression: { google_id: { $type: 'string' } } },
);

usuarioSchema.index({ rol: 1 });

export default model('Usuario', usuarioSchema);
