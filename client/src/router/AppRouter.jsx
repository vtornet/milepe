import { Routes, Route } from 'react-router-dom';
import MuroPage from '../pages/Muro/MuroPage.jsx';
import QuejasPage from '../pages/Quejas/QuejasPage.jsx';
import LoginPage from '../pages/Auth/LoginPage.jsx';
import RegistroPage from '../pages/Auth/RegistroPage.jsx';
import RecuperarPage from '../pages/Auth/RecuperarPage.jsx';
import RestablecerPage from '../pages/Auth/RestablecerPage.jsx';
import VerificarPage from '../pages/Auth/VerificarPage.jsx';
import PerfilPage from '../pages/Perfil/PerfilPage.jsx';
import CompletarPerfilPage from '../pages/Perfil/CompletarPerfilPage.jsx';
import VecinoPage from '../pages/Perfil/VecinoPage.jsx';
import PrivacidadPage from '../pages/Legal/PrivacidadPage.jsx';
import CondicionesPage from '../pages/Legal/CondicionesPage.jsx';
import TurismoPage from '../pages/Turismo/TurismoPage.jsx';
import TurismoSeccionPage from '../pages/Turismo/TurismoSeccionPage.jsx';
import FotosPage from '../pages/Fotos/FotosPage.jsx';
import EventosPage from '../pages/Eventos/EventosPage.jsx';
import TiempoPage from '../pages/Tiempo/TiempoPage.jsx';
import EmpleoPage from '../pages/Empleo/EmpleoPage.jsx';
import NegociosPage from '../pages/Negocios/NegociosPage.jsx';
import ContactosPage from '../pages/Contactos/ContactosPage.jsx';
import FarmaciasPage from '../pages/Farmacias/FarmaciasPage.jsx';
import AvisosPage from '../pages/Avisos/AvisosPage.jsx';
import TablonPage from '../pages/Tablon/TablonPage.jsx';
import MensajesPage from '../pages/Mensajes/MensajesPage.jsx';
import ConversacionPage from '../pages/Mensajes/ConversacionPage.jsx';
import ModeracionPage from '../pages/Moderacion/ModeracionPage.jsx';
import MiContenidoModeradoPage from '../pages/Moderacion/MiContenidoModeradoPage.jsx';
import RutaProtegida from './RutaProtegida.jsx';
import RutaRol from './RutaRol.jsx';

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<MuroPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      {/* Las dos mitades de la recuperacion. Publicas: quien ha perdido la
          contraseña no tiene sesion. /restablecer lee el token de la query
          del enlace del correo. */}
      <Route path="/recuperar" element={<RecuperarPage />} />
      <Route path="/restablecer" element={<RestablecerPage />} />
      {/* Publica: el enlace del correo se abre a veces en otro dispositivo
          donde no hay sesion iniciada. */}
      <Route path="/verificar" element={<VerificarPage />} />

      {/* Publicas y sin sesion a proposito: Google exige poder abrirlas sin
          estar registrado para publicar la app, y quien se esta planteando
          crear la cuenta tiene que poder leerlas antes. */}
      <Route path="/privacidad" element={<PrivacidadPage />} />
      <Route path="/condiciones" element={<CondicionesPage />} />
      <Route path="/quejas" element={<QuejasPage />} />
      <Route path="/turismo" element={<TurismoPage />} />
      <Route path="/turismo/:seccion" element={<TurismoSeccionPage />} />
      <Route path="/fotos" element={<FotosPage />} />
      <Route path="/eventos" element={<EventosPage />} />
      <Route path="/tiempo" element={<TiempoPage />} />
      <Route path="/empleo" element={<EmpleoPage />} />
      <Route path="/negocios" element={<NegociosPage />} />
      <Route path="/contactos" element={<ContactosPage />} />
      <Route path="/farmacias" element={<FarmaciasPage />} />
      <Route path="/avisos" element={<AvisosPage />} />
      <Route path="/tablon" element={<TablonPage />} />

      {/* La ficha de un vecino es publica, como el resto del muro: sin
          sesion se ve quien es y lo que ha publicado, y lo que no aparece
          son los botones de seguirle y escribirle. */}
      <Route path="/vecino/:id" element={<VecinoPage />} />

      {/* La mensajeria es la unica parte que exige sesion para entrar y no
          solo para actuar: un hilo privado no se puede ni listar sin saber
          quien eres. De ahi que sea el primer uso real de RutaProtegida. */}
      <Route
        path="/mensajes"
        element={
          <RutaProtegida>
            <MensajesPage />
          </RutaProtegida>
        }
      />
      <Route
        path="/mensajes/:id"
        element={
          <RutaProtegida>
            <ConversacionPage />
          </RutaProtegida>
        }
      />

      {/* El panel del equipo exige rol; la vista del autor sancionado solo
          sesion, porque cualquiera puede tener algo oculto que apelar. */}
      <Route
        path="/moderacion"
        element={
          <RutaRol roles={['moderador', 'admin']}>
            <ModeracionPage />
          </RutaRol>
        }
      />
      <Route
        path="/mi-contenido"
        element={
          <RutaProtegida>
            <MiContenidoModeradoPage />
          </RutaProtegida>
        }
      />
      <Route
        path="/perfil"
        element={
          <RutaProtegida>
            <PerfilPage />
          </RutaProtegida>
        }
      />
      <Route
        path="/completar-perfil"
        element={
          <RutaProtegida>
            <CompletarPerfilPage />
          </RutaProtegida>
        }
      />
    </Routes>
  );
}

export default AppRouter;
