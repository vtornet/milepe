import mongoose from 'mongoose';
import puntoSchema from './schemas/puntoSchema.js';

const { Schema, model } = mongoose;

// Las siete secciones de turismo.lepe.es que tienen contenido propio (Agenda
// ya es la seccion Eventos; mapa, buscador y planificador son herramientas,
// no contenido). El enum vive aqui para que controlador y validadores lo
// reusen; las etiquetas y descripciones que se pintan estan en el cliente.
export const SECCIONES_TURISMO = [
  'sol_y_playa',
  'turismo_activo',
  'turismo_cultural',
  'gastronomia',
  'alojamientos',
  'servicios_turisticos',
  'rutas',
];

// Turismo es informacion que mantiene un admin, igual que ContactoInteres:
// no es un Post (sin autor vecino, sin moderacion, sin reacciones ni
// comentarios) porque no es algo que un vecino publique.
const recursoTuristicoSchema = new Schema(
  {
    seccion: {
      type: String,
      enum: SECCIONES_TURISMO,
      required: [true, 'La seccion es obligatoria'],
    },
    titulo: {
      type: String,
      required: [true, 'El titulo es obligatorio'],
      trim: true,
      maxlength: 120,
    },
    descripcion: {
      type: String,
      required: [true, 'La descripcion es obligatoria'],
      trim: true,
      maxlength: 5000,
    },
    // URLs ya subidas (POST /api/subidas/imagenes), como en Post.imagenes.
    imagenes: {
      type: [String],
      default: [],
      validate: {
        validator: (lista) => lista.length <= 10,
        message: 'Un recurso admite como maximo 10 imagenes',
      },
    },
    // Opcional: no todo recurso tiene un punto (una ruta sin trazado
    // fijado, un servicio sin sede). Los que no lo tienen no entran en las
    // consultas geoespaciales.
    ubicacion: {
      type: puntoSchema,
      default: null,
    },
    direccion: { type: String, trim: true, maxlength: 200, default: null },
    telefono: { type: String, trim: true, maxlength: 30, default: null },
    // Web propia del recurso (la de la escuela de hipica, la del paseo en
    // barco...). Distinta de `fuente`, que es de donde sale la ficha.
    web: { type: String, trim: true, maxlength: 300, default: null },
    fuente: { type: String, trim: true, maxlength: 300, default: null },
    orden: { type: Number, default: 0 },
    // Ocultar sin perder los datos, igual que ContactoInteres.activo.
    activo: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

// Listado de una seccion: activos, en el orden que fije el admin.
recursoTuristicoSchema.index({ seccion: 1, activo: 1, orden: 1 });
recursoTuristicoSchema.index({ ubicacion: '2dsphere' });

export default model('RecursoTuristico', recursoTuristicoSchema);
