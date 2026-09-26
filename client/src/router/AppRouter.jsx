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
    </Routes>
  );
}

export default AppRouter;
