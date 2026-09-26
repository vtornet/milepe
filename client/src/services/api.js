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
    return Promise.reject(error);
  },
);

export default api;
