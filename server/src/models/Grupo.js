import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Grupos de vecinos: un barrio, una asociación, una hermandad, una peña, un
// club. Son públicos (cualquiera lee lo que se publica en ellos), unirse es
// libre y al momento, y solo los miembros publican. Lo que se publica es un
// Post de tipo 'grupo' (ver PublicacionGrupoDetalle), así que reacciones,
// comentarios y moderación son los de siempre.
export const CATEGORIAS_GRUPO = ['barrio', 'asociacion', 'hermandad', 'pena', 'club', 'otro'];

// "Peña El Terrao" y "peña el terrao" son el mismo grupo.
export const claveDeNombre = (nombre) =>
  String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const grupoSchema = new Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre del grupo es obligatorio'],
      trim: true,
      minlength: [3, 'El nombre es demasiado corto'],
      maxlength: [80, 'El nombre es demasiado largo'],
    },
    // Lo que hace único al nombre; lo calcula el hook, nunca el cliente.
    clave: { type: String, unique: true },
    descripcion: {
      type: String,
      required: [true, 'Cuenta de qué va el grupo'],
      trim: true,
      maxlength: [1000, 'La descripción es demasiado larga'],
    },
    categoria: {
      type: String,
      enum: CATEGORIAS_GRUPO,
      required: [true, 'La categoría es obligatoria'],
    },
    // Quien lo creó: puede cambiar el nombre y la descripción. No puede
    // salirse (el grupo se quedaría sin nadie que lo lleve).
    creador_id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    // Contador desnormalizado (se lista ordenado por él); lo mueven
    // unirse/salir con $inc, igual que asistentes en EventoDetalle.
    num_miembros: { type: Number, default: 0, min: 0 },
    // Un admin de MiLepe puede retirarlo (no se borra: sus publicaciones
    // siguen apuntando aquí).
    activo: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

grupoSchema.pre('validate', function calcularClave() {
  if (this.isModified('nombre')) this.clave = claveDeNombre(this.nombre);
});

grupoSchema.index({ activo: 1, num_miembros: -1 });

export default model('Grupo', grupoSchema);
