import ErrorHttp from '../utils/ErrorHttp.js';

// Puerta de entrada a todo lo que escribe: publicar, comentar, reaccionar,
// reportar, enviar un mensaje. Se usa SIEMPRE despues de protegido.
//
// Dos condiciones, y las dos tienen el mismo fin: que detras de cada cosa
// publicada en MiLepe haya una persona localizable.
//
//   1. El correo verificado. Sin esto, cualquiera se registra con la
//      direccion de otro -o con una inventada- y publica a su nombre.
//   2. El perfil completo (nombre y apellidos reales, foto). Es lo que
//      convierte una cuenta en alguien identificable ante una denuncia.
//
// Leer NO exige nada de esto: MiLepe se lee sin cuenta siquiera, y obligar
// a verificar para mirar el muro solo espantaria a los vecinos.
//
// El codigo 403 va acompañado de un motivo legible por el cliente
// (`razon`), porque las dos situaciones llevan a pantallas distintas: una
// a "mira tu correo" y la otra al formulario de perfil. Sin ese dato, el
// cliente tendria que adivinarlo del texto del mensaje.
export const exigePerfilCompleto = (req, res, next) => {
  if (!req.usuario) {
    return next(new ErrorHttp(401, 'No autenticado'));
  }

  if (!req.usuario.email_verificado) {
    return next(
      Object.assign(
        new ErrorHttp(403, 'Verifica tu correo electronico antes de publicar. Te hemos enviado un enlace.'),
        { razon: 'email_sin_verificar' },
      ),
    );
  }

  if (!req.usuario.perfil_completo) {
    return next(
      Object.assign(new ErrorHttp(403, 'Completa tu perfil antes de publicar.'), { razon: 'perfil_incompleto' }),
    );
  }

  next();
};
