import { Routes, Route } from 'react-router-dom';
import MuroPage from '../pages/Muro/MuroPage.jsx';
import QuejasPage from '../pages/Quejas/QuejasPage.jsx';
import LoginPage from '../pages/Auth/LoginPage.jsx';
import RegistroPage from '../pages/Auth/RegistroPage.jsx';
import TurismoPage from '../pages/Turismo/TurismoPage.jsx';
import FotosPage from '../pages/Fotos/FotosPage.jsx';
import EventosPage from '../pages/Eventos/EventosPage.jsx';
import TiempoPage from '../pages/Tiempo/TiempoPage.jsx';
import EmpleoPage from '../pages/Empleo/EmpleoPage.jsx';
import NegociosPage from '../pages/Negocios/NegociosPage.jsx';
import ContactosPage from '../pages/Contactos/ContactosPage.jsx';
import MensajesPage from '../pages/Mensajes/MensajesPage.jsx';
import ConversacionPage from '../pages/Mensajes/ConversacionPage.jsx';
import RutaProtegida from './RutaProtegida.jsx';

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<MuroPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/quejas" element={<QuejasPage />} />
      <Route path="/turismo" element={<TurismoPage />} />
      <Route path="/fotos" element={<FotosPage />} />
      <Route path="/eventos" element={<EventosPage />} />
      <Route path="/tiempo" element={<TiempoPage />} />
      <Route path="/empleo" element={<EmpleoPage />} />
      <Route path="/negocios" element={<NegociosPage />} />
      <Route path="/contactos" element={<ContactosPage />} />

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
    </Routes>
  );
}

export default AppRouter;
