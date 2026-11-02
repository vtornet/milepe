import Stripe from 'stripe';

// Cobros con Stripe Checkout: pago unico, nada de suscripciones. Un vecino
// paga X dias de destacado y punto; al acabar, si quiere, vuelve a pagar y se
// suma a lo que le quede (NegocioDetalle.extenderDestacado).
//
// Mismo contrato que el correo y el push: SIN CONFIGURAR NO ROMPE NADA. Sin
// STRIPE_SECRET_KEY la API dice `activo: false` y el cliente no ensena los
// botones de pagar. Las claves de prueba (sk_test_...) cobran con tarjetas
// ficticias; pasar a cobros reales es cambiar las dos variables en Railway.

// Lo que se vende. Los importes en centimos, IVA incluido; se pueden
// cambiar con variables de entorno sin tocar el codigo.
export const PRODUCTOS = {
  negocio_destacado: {
    nombre: 'Negocio destacado en MiLepe (30 días)',
    importe: () => Number(process.env.PRECIO_NEGOCIO_DESTACADO_CENT) || 990,
    dias: 30,
  },
  evento_patrocinado: {
    nombre: 'Evento patrocinado en MiLepe',
    importe: () => Number(process.env.PRECIO_EVENTO_PATROCINADO_CENT) || 490,
    // Hasta la fecha del evento, con este maximo.
    dias: 30,
  },
  // La unica suscripcion: se cobra cada mes hasta que el vecino se da de
  // baja (y entonces dura hasta el final del mes pagado).
  verificacion: {
    nombre: 'Perfil verificado en MiLepe',
    importe: () => Number(process.env.PRECIO_VERIFICACION_CENT) || 150,
    dias: 30,
    suscripcion: true,
  },
};

// Consentimiento de derecho de desistimiento para servicios digitales de pago
// (Ley General para la Defensa de los Consumidores y Usuarios, art. 103): el
// vecino acepta que el servicio empieza de inmediato y renuncia al desistimiento
// de 14 días. Se muestra en el boton de aceptacion de condiciones de Stripe
// Checkout y se exige antes de poder pagar.
export const CONSENTIMIENTO_DESISTIMIENTO =
  'Al pagar, acepto que el servicio comience de inmediato y renuncio a mi derecho de desistimiento de 14 días.';

let cliente = null;

export const pagosActivos = () => Boolean(process.env.STRIPE_SECRET_KEY);

export const stripe = () => {
  if (!pagosActivos()) return null;
  if (!cliente) cliente = new Stripe(process.env.STRIPE_SECRET_KEY.trim());
  return cliente;
};

// Para los tests: inyectar un Stripe falso.
export const usarClienteStripe = (falso) => {
  cliente = falso;
};

// sk_ = clave estandar, rk_ = clave restringida (la que se usa en real: la
// estandar de la cuenta la comparten otros proyectos y no se puede revelar).
export const esModoPrueba = () => /^(sk|rk)_test_/.test((process.env.STRIPE_SECRET_KEY || '').trim());
