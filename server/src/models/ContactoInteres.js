import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Los cuatro que pide el proyecto, mas un par de habituales en un pueblo y
// un cajon de sastre para lo que no encaje. No forma parte de TIPOS_POST:
// esto es una ficha estatica editable por un admin, no una publicacion del
// feed.
export const CATEGORIAS_CONTACTO = [
  'ayuntamiento',
  'policia_local',
  'proteccion_civil',
  'guardia_civil',
  'bomberos',
  'centro_salud',
  'otro',
];

const contactoInteresSchema = new Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre del contacto es obligatorio'],
      trim: true,
      maxlength: 100,
    },
    categoria: {
      type: String,
      enum: CATEGORIAS_CONTACTO,
      required: [true, 'La categoria del contacto es obligatoria'],
    },
    telefono: {
      type: String,
      required: [true, 'El telefono es obligatorio'],
      trim: true,
      maxlength: 20,
    },
    telefono_alternativo: {
      type: String,
      trim: true,
      maxlength: 20,
      default: null,
    },
    // Numero de WhatsApp si el servicio atiende por ahi (aparte del
    // telefono normal). whatsapp_url (mas abajo) construye el enlace wa.me
    // listo para usar en el front.
    whatsapp: {
      type: String,
      trim: true,
      maxlength: 20,
      default: null,
    },
    // Opcional: algunos servicios de interes no publican una direccion
    // concreta (p. ej. una linea de emergencias).
    direccion: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },
    // Texto libre, igual que NegocioDetalle.horario ("Atencion 24 horas",
    // "L-V 9:00-14:00"...).
    horario: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },
    // Permite al admin fijar el orden de aparicion en la ficha sin
    // depender del orden alfabetico ni de la fecha de creacion.
    orden: {
      type: Number,
      default: 0,
    },
    // Ocultar un contacto (p. ej. un servicio estacional fuera de
    // temporada) sin borrar su ficha ni perder los datos.
    activo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Listado de la seccion: activos primero, agrupados por categoria y en el
// orden que haya fijado el admin.
contactoInteresSchema.index({ activo: 1, categoria: 1, orden: 1 });

// Enlace wa.me listo para un boton "Escribir por WhatsApp" en el front. null
// si el contacto no tiene whatsapp.
contactoInteresSchema.virtual('whatsapp_url').get(function calcularWhatsappUrl() {
  if (!this.whatsapp) return null;
  const soloDigitos = this.whatsapp.replace(/[^\d]/g, '');
  return `https://wa.me/${soloDigitos}`;
});

export default model('ContactoInteres', contactoInteresSchema);
