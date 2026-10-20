import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../services/api.js';

// Misma clave que ya usaba el interceptor de api.js (no la cambiamos: ya
// habia un contrato implicito de donde vive el token).
const CLAVE_TOKEN = 'milepe_token';
const CLAVE_USUARIO = 'milepe_usuario';

const AuthContext = createContext(null);

// Envuelve toda la app (ver App.jsx). Guarda el usuario y el token en
// localStorage para que la sesion sobreviva a un F5, y expone las cuatro
// formas de abrir sesion (contraseña, registro, Google y restablecer) mas
// logout, para que ninguna pagina tenga que repetir la llamada a la API ni
// el guardado en localStorage.
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const usuarioGuardado = localStorage.getItem(CLAVE_USUARIO);
    const tokenGuardado = localStorage.getItem(CLAVE_TOKEN);

    if (usuarioGuardado && tokenGuardado) {
      try {
        setUsuario(JSON.parse(usuarioGuardado));
      } catch {
        localStorage.removeItem(CLAVE_USUARIO);
        localStorage.removeItem(CLAVE_TOKEN);
      }
    }

    setCargando(false);
  }, []);

  const guardarSesion = (token, usuarioNuevo) => {
    localStorage.setItem(CLAVE_TOKEN, token);
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuarioNuevo));
    setUsuario(usuarioNuevo);
  };

  const login = useCallback(async (email, contraseña) => {
    const { data } = await api.post('/auth/login', { email, contraseña });
    guardarSesion(data.token, data.usuario);
    return data.usuario;
  }, []);

  const registro = useCallback(async (datos) => {
    const { data } = await api.post('/auth/registro', datos);
    guardarSesion(data.token, data.usuario);
    return data.usuario;
  }, []);

  // Google devuelve un "credential" (un ID token firmado por Google). Aqui
  // solo se reenvia: quien decide si vale es el servidor, que lo verifica
  // contra las claves publicas de Google. El cliente no comprueba nada,
  // porque cualquier comprobacion hecha aqui se la puede saltar quien
  // quiera.
  const entrarConGoogle = useCallback(async (credential) => {
    const { data } = await api.post('/auth/google', { credential });
    guardarSesion(data.token, data.usuario);
    return data.usuario;
  }, []);

  // Restablecer deja la sesion abierta: quien acaba de demostrar que
  // controla el correo y ha elegido contraseña nueva no tiene por que
  // escribirla otra vez en la pantalla de acceso.
  const restablecer = useCallback(async (token, contraseña) => {
    const { data } = await api.post('/auth/restablecer', { token, contraseña });
    guardarSesion(data.token, data.usuario);
    return data.usuario;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    setUsuario(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ usuario, cargando, login, registro, entrarConGoogle, restablecer, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return contexto;
}
