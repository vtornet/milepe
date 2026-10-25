import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Un pago con Stripe Checkout. Se crea 'pendiente' al abrir la pasarela y lo
// cierra el webhook de Stripe (nunca la vuelta del navegador, que cualquiera
// puede falsear escribiendo la URL de "pago correcto").
//
// Aplicar el pago (dar los dias de destacado) ocurre UNA vez aunque Stripe
// mande el mismo evento varias veces, que lo hace: el paso de 'pendiente' a
// 'pagado' es un findOneAndUpdate condicionado (ver aplicarPago).
//
// No se borran al eliminar una cuenta: un cobro es un registro contable que
// hay que conservar. La cuenta anonimizada sigue apuntando aqui.
export const ESTADOS_PAGO = ['pendiente', 'pagado', 'caducado', 'fallido'];
export const PRODUCTOS_PAGO = ['negocio_destacado', 'evento_patrocinado', 'verificacion'];

const pagoSchema = new Schema(
  {
    usuario_id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    producto: { type: String, enum: PRODUCTOS_PAGO, required: true },
    // La verificacion (suscripcion) no va sobre ninguna publicacion.
    post_id: { type: Schema.Types.ObjectId, ref: 'Post', required: [function requierePost() { return this.producto !== 'verificacion'; }, 'Falta la publicacion'] },
    importe: { type: Number, required: true, min: 0 }, // centimos
    moneda: { type: String, default: 'eur' },
    dias: { type: Number, required: true, min: 1 },
    estado: { type: String, enum: ESTADOS_PAGO, default: 'pendiente' },
    stripe_sesion_id: { type: String, default: null },
    stripe_pago_id: { type: String, default: null },
    // Cada mes de la suscripcion es una factura: su id hace que un aviso
    // repetido de Stripe no la cuente dos veces.
    stripe_factura_id: { type: String, default: null },
    modo_prueba: { type: Boolean, default: false },
    // Hasta cuando quedo destacado/patrocinado tras aplicarlo.
    vigente_hasta: { type: Date, default: null },
    pagado_en: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'fecha_actualizacion' },
  },
);

pagoSchema.index({ stripe_sesion_id: 1 }, { unique: true, partialFilterExpression: { stripe_sesion_id: { $type: 'string' } } });
pagoSchema.index({ usuario_id: 1, fecha_creacion: -1 });
pagoSchema.index({ stripe_factura_id: 1 }, { unique: true, partialFilterExpression: { stripe_factura_id: { $type: 'string' } } });

export default model('Pago', pagoSchema);
