import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { EsqueletoFeed } from '../components/Esqueleto.jsx';
import GrupoPestanas from './GrupoPestanas.jsx';
import MuroPage from '../pages/Muro/MuroPage.jsx';
import RutaProtegida from './RutaProtegida.jsx';
import RutaRol from './RutaRol.jsx';

// Si falla la descarga de una página es casi siempre porque se ha publicado
// una versión nueva y la que tiene abierta el vecino pide un archivo que ya
// no existe: se recarga la web UNA vez (la marca en sessionStorage evita un
// bucle si el fallo es otro, como estar sin conexión).
const perezosa = (cargar) =>
  lazy(() =>
    cargar()
      .then((modulo) => {
        try {
          sessionStorage.removeItem('milepe_recargado');
        } catch {
          /* sin almacenamiento: no pasa nada */
        }
        return modulo;
      })
      .catch((error) => {
        let yaRecargado = false;
        try {
          yaRecargado = sessionStorage.getItem('milepe_recargado') === '1';
          if (!yaRecargado) sessionStorage.setItem('milepe_recargado', '1');
        } catch {
          yaRecargado = true;
        }
        if (!yaRecargado) window.location.reload();
        throw error;
      }),
  );

// Cada página se descarga al abrirla (el Muro, que es la portada, va en el
// paquete principal). Así la primera carga en el móvil no trae todas las
// secciones ni el mapa de golpe.
const QuejasPage = perezosa(() => import('../pages/Quejas/QuejasPage.jsx'));
const LoginPage = perezosa(() => import('../pages/Auth/LoginPage.jsx'));
const RegistroPage = perezosa(() => import('../pages/Auth/RegistroPage.jsx'));
const RecuperarPage = perezosa(() => import('../pages/Auth/RecuperarPage.jsx'));
const RestablecerPage = perezosa(() => import('../pages/Auth/RestablecerPage.jsx'));
const VerificarPage = perezosa(() => import('../pages/Auth/VerificarPage.jsx'));
const PerfilPage = perezosa(() => import('../pages/Perfil/PerfilPage.jsx'));
const CompletarPerfilPage = perezosa(() => import('../pages/Perfil/CompletarPerfilPage.jsx'));
const VecinoPage = perezosa(() => import('../pages/Perfil/VecinoPage.jsx'));
const PrivacidadPage = perezosa(() => import('../pages/Legal/PrivacidadPage.jsx'));
const CondicionesPage = perezosa(() => import('../pages/Legal/CondicionesPage.jsx'));
const TurismoPage = perezosa(() => import('../pages/Turismo/TurismoPage.jsx'));
const TurismoSeccionPage = perezosa(() => import('../pages/Turismo/TurismoSeccionPage.jsx'));
const FotosPage = perezosa(() => import('../pages/Fotos/FotosPage.jsx'));
const EventosPage = perezosa(() => import('../pages/Eventos/EventosPage.jsx'));
const TiempoPage = perezosa(() => import('../pages/Tiempo/TiempoPage.jsx'));
const EmpleoPage = perezosa(() => import('../pages/Empleo/EmpleoPage.jsx'));
const NegociosPage = perezosa(() => import('../pages/Negocios/NegociosPage.jsx'));
const ContactosPage = perezosa(() => import('../pages/Contactos/ContactosPage.jsx'));
const FarmaciasPage = perezosa(() => import('../pages/Farmacias/FarmaciasPage.jsx'));
const AvisosPage = perezosa(() => import('../pages/Avisos/AvisosPage.jsx'));
const TablonPage = perezosa(() => import('../pages/Tablon/TablonPage.jsx'));
const AnimalesPage = perezosa(() => import('../pages/Animales/AnimalesPage.jsx'));
const BuscarPage = perezosa(() => import('../pages/Buscar/BuscarPage.jsx'));
const EncuestasPage = perezosa(() => import('../pages/Encuestas/EncuestasPage.jsx'));
const PublicacionPage = perezosa(() => import('../pages/Publicacion/PublicacionPage.jsx'));
const NotificacionesPage = perezosa(() => import('../pages/Notificaciones/NotificacionesPage.jsx'));
const MensajesPage = perezosa(() => import('../pages/Mensajes/MensajesPage.jsx'));
const ConversacionPage = perezosa(() => import('../pages/Mensajes/ConversacionPage.jsx'));
const ModeracionPage = perezosa(() => import('../pages/Moderacion/ModeracionPage.jsx'));
const MiContenidoModeradoPage = perezosa(() => import('../pages/Moderacion/MiContenidoModeradoPage.jsx'));

function AppRouter() {
  return (
    <Suspense fallback={<EsqueletoFeed />}>
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
      <Route path="/negocios" element={<NegociosPage />} />
      <Route path="/avisos" element={<AvisosPage />} />
      <Route path="/buscar" element={<BuscarPage />} />
      <Route path="/encuestas" element={<EncuestasPage />} />
      {/* Una publicación sola: el destino de los enlaces compartidos. */}
      <Route path="/p/:id" element={<PublicacionPage />} />
      <Route
        path="/notificaciones"
        element={
          <RutaProtegida>
            <NotificacionesPage />
          </RutaProtegida>
        }
      />

      {/* Grupos: cada pestaña conserva su ruta de siempre; el grupo solo
          añade la fila de pestañas encima. */}
      <Route element={<GrupoPestanas grupo="tablon" />}>
        <Route path="/tablon" element={<TablonPage />} />
        <Route path="/animales" element={<AnimalesPage />} />
        <Route path="/empleo" element={<EmpleoPage />} />
      </Route>
      <Route path="/util" element={<Navigate to="/tiempo" replace />} />
      <Route element={<GrupoPestanas grupo="util" />}>
        <Route path="/tiempo" element={<TiempoPage />} />
        <Route path="/farmacias" element={<FarmaciasPage />} />
        <Route path="/contactos" element={<ContactosPage />} />
      </Route>

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
    </Suspense>
  );
}

export default AppRouter;
