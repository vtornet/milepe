// Error con un status HTTP asociado. El gestor de errores central
// (app.js) lo usa directamente; para todo lo demas (errores de Mongoose,
// etc.) el propio gestor sabe traducirlos.
class ErrorHttp extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

export default ErrorHttp;
