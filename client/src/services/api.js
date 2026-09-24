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

export default api;
