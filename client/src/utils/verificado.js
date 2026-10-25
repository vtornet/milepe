// Mismo criterio que Usuario.estaVerificado() en el servidor: concedido por un
// admin, o suscripción pagada cuyo periodo no ha terminado.
export const esVerificado = (usuario) =>
  Boolean(usuario?.verificado_manual || (usuario?.verificado_hasta && new Date(usuario.verificado_hasta) > new Date()));
