import axios from 'axios';

// Instancia central de axios. Cada servicio de seccion (quejasApi, empleoApi...)
// importa esta instancia en vez de crear la suya, para compartir baseURL,
// headers de autenticacion e interceptores de error.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('milepe_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Si el servidor dice que el token ya no vale (caducado, o la cuenta se
// desactivo desde que se emitio), no tiene sentido conservarlo: lo
// limpiamos aqui, en el sitio unico donde toda peticion pasa, en vez de
// repetir la comprobacion en cada componente. AuthContext lee de
// localStorage al montar, asi que un F5 ya basta para que la app refleje
// la sesion cerrada; los componentes montados en ese momento simplemente
// veran fallar su siguiente peticion protegida.
api.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('milepe_token');
      localStorage.removeItem('milepe_usuario');
    }
    // Si suspenden la cuenta con la sesion abierta, cada peticion protegida
    // contesta 403 con este motivo: se cierra la sesion y se lleva a la
    // pantalla de entrar, que ensena el mensaje (con la fecha y el motivo).
    if (error.response?.status === 403 && error.response.data?.razon === 'cuenta_suspendida') {
      localStorage.removeItem('milepe_token');
      localStorage.removeItem('milepe_usuario');
      try {
        sessionStorage.setItem('milepe_suspension', error.response.data.mensaje || '');
      } catch {
        // Sin sessionStorage la pantalla de entrar no da el motivo; al
        // intentar entrar, el servidor lo vuelve a decir.
      }
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login');
    }
    return Promise.reject(error);
  },
);

export default api;
