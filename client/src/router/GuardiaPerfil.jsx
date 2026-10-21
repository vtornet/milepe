import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Rutas por las que un usuario con el perfil sin terminar SÍ puede pasar.
// La lista existe para no encerrarlo: sin ella, /completar-perfil se
// redirigiría a sí misma en bucle, y quien abriera el enlace del correo de
// verificación acabaría en el formulario en vez de en la confirmación.
//
// Las páginas legales entran porque hay que poder leerlas justo cuando te
// están pidiendo datos personales, que es el momento en que más sentido
// tiene leerlas.
const RUTAS_PERMITIDAS = ['/completar-perfil', '/verificar', '/privacidad', '/condiciones', '/login', '/registro'];

// Lleva al formulario de alta a quien tenga el perfil a medias.
//
// Solo redirige en las rutas que exigen tener el perfil hecho, no en todas:
// MiLepe se puede mirar entera sin cuenta siquiera, así que encerrar a
// quien acaba de registrarse en un formulario, sin dejarle ver antes qué
// es esto, sería la mejor forma de que cerrara la pestaña.
//
// Esto es comodidad de navegación, no seguridad: quien de verdad lo impide
// es exigePerfilCompleto en el servidor, que rechaza toda petición que
// escriba mientras falten datos.
function GuardiaPerfil({ children }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando || !usuario) return children;

  const permitida = RUTAS_PERMITIDAS.some((ruta) => location.pathname.startsWith(ruta));

  // Se compara con false EXPLICITO, no por "es falso". La diferencia
  // importa: si el servidor todavia no conoce este campo -porque el
  // cliente se ha desplegado antes que la API, que es justo lo que paso-
  // llega undefined, y tratarlo como "perfil incompleto" encierra en el
  // formulario de alta a TODOS los vecinos con sesion, incluso para leer.
  //
  // Un cliente mas nuevo que su API tiene que degradar a no hacer nada,
  // nunca a bloquear. Quien de verdad lo impide es exigePerfilCompleto en
  // el servidor, que rechaza las peticiones que escriben.
  if (usuario.perfil_completo === false && !permitida) {
    return <Navigate to="/completar-perfil" replace state={{ desde: location.pathname }} />;
  }

  return children;
}

export default GuardiaPerfil;
