import { OAuth2Client } from 'google-auth-library';

// Verificacion del token de Google.
//
// Se usa el flujo de "ID token" de Google Identity Services, no el OAuth2
// clasico con redirecciones y callback: el cliente obtiene un ID token
// firmado por Google y lo manda aqui. Encaja con lo que ya hay -una API sin
// sesiones, que responde con su propio JWT- y evita tener que guardar
// estado entre la ida y la vuelta de una redireccion.
//
// Lo que NO se puede hacer nunca es fiarse de lo que mande el cliente sin
// comprobarlo: el ID token hay que verificarlo contra las claves publicas
// de Google. Si no, cualquiera podria mandar un JSON con el correo de otro
// vecino y entrar como él.
let cliente = null;

const obtenerCliente = () => {
  if (!cliente) cliente = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return cliente;
};

/**
 * Comprueba el ID token y devuelve los datos del usuario de Google.
 * Lanza si el token no es valido, esta caducado o no fue emitido para
 * nuestra aplicacion.
 */
export const verificarTokenGoogle = async (credential) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID no esta configurada');
  }

  const ticket = await obtenerCliente().verifyIdToken({
    idToken: credential,
    // Esto es lo que ata el token a NUESTRA aplicacion. Sin audience, un
    // token legitimo de Google emitido para cualquier otra web serviria
    // para entrar aqui.
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const datos = ticket.getPayload();

  // Google puede devolver una cuenta cuyo correo no ha verificado. Enlazar
  // por email sin comprobar esto permitiria apropiarse de la cuenta de otro
  // vecino: basta con registrar en Google un correo ajeno sin verificarlo.
  if (!datos.email_verified) {
    throw new Error('La cuenta de Google no tiene el correo verificado');
  }

  return {
    google_id: datos.sub,
    email: datos.email.toLowerCase(),
    nombre: datos.name || datos.given_name || datos.email.split('@')[0],
    avatar_url: datos.picture || null,
  };
};

/**
 * Inventa un nombre de usuario libre a partir del correo o del nombre.
 * Quien entra con Google nunca elige uno, pero el modelo lo exige (es
 * unico y se enseña en cada publicacion).
 *
 * Normaliza igual que el formulario de registro del cliente: quita tildes,
 * cambia lo que no valga por guion bajo y recorta a lo que admite el
 * modelo. Si ya existe, va probando sufijos.
 */
export const generarNombreUsuarioLibre = async (Usuario, semilla) => {
  const base =
    semilla
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^[._-]+|[._-]+$/g, '')
      .slice(0, 24)
      .toLowerCase() || 'vecino';

  // El modelo exige 3 caracteres como minimo.
  const raiz = base.length >= 3 ? base : `${base}_lepe`.slice(0, 24);

  if (!(await Usuario.exists({ nombre_usuario: raiz }))) return raiz;

  // Sufijo numerico; el limite evita un bucle infinito si algo va mal.
  for (let i = 2; i < 1000; i += 1) {
    const candidato = `${raiz.slice(0, 26)}${i}`;
    if (!(await Usuario.exists({ nombre_usuario: candidato }))) return candidato;
  }

  // Ultimo recurso: practicamente imposible de colisionar.
  return `vecino_${Date.now().toString(36)}`;
};
