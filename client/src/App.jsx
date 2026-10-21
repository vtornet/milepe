import { useEffect, useState } from 'react';
import AppRouter from './router/AppRouter.jsx';
import GuardiaPerfil from './router/GuardiaPerfil.jsx';
import BarraSuperior from './components/BarraSuperior.jsx';
import NavegacionLateral from './components/NavegacionLateral.jsx';
import BarraInferior from './components/BarraInferior.jsx';
import RailDerecho from './components/RailDerecho.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ReaccionesProvider } from './context/ReaccionesContext.jsx';
import { SeguimientosProvider } from './context/SeguimientosContext.jsx';
import api from './services/api.js';

// Los tres sitios donde se enseñan avisos (la barra superior, la lateral y
// la barra de pestañas) necesitan los mismos contadores, así que se piden
// una vez aquí y se reparten por props. Si cada uno los pidiera por su
// cuenta serían tres peticiones iguales por carga de página.
function Armazon() {
  const { usuario } = useAuth();

  const [pendientesModeracion, setPendientesModeracion] = useState(0);
  const [tengoSanciones, setTengoSanciones] = useState(false);
  const [noLeidos, setNoLeidos] = useState(0);

  const esEquipo = usuario?.rol === 'moderador' || usuario?.rol === 'admin';

  useEffect(() => {
    if (!usuario) {
      setPendientesModeracion(0);
      setTengoSanciones(false);
      setNoLeidos(0);
      return undefined;
    }

    let cancelado = false;

    // Un fallo en cualquiera de estas no se enseña: son contadores, y un
    // aviso de error en la barra por no poder pintar un número sería peor
    // que no pintarlo.
    api
      .get('/moderacion/mi-contenido-moderado')
      .then(({ data }) => {
        if (!cancelado) setTengoSanciones(data.contenido.length > 0);
      })
      .catch(() => {});

    api
      .get('/conversaciones')
      .then(({ data }) => {
        if (!cancelado) {
          setNoLeidos(data.conversaciones.reduce((suma, c) => suma + (c.no_leidos || 0), 0));
        }
      })
      .catch(() => {});

    if (esEquipo) {
      api
        .get('/moderacion/resumen')
        .then(({ data }) => {
          if (!cancelado) {
            setPendientesModeracion(
              data.reportes_pendientes + data.apelaciones_pendientes + (data.ediciones_pendientes || 0),
            );
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelado = true;
    };
  }, [usuario, esEquipo]);

  return (
    <>
      <BarraSuperior pendientesModeracion={pendientesModeracion} />

      <div className="armazon">
        <NavegacionLateral pendientesModeracion={pendientesModeracion} tengoSanciones={tengoSanciones} />

        <main className="contenido">
          {/* Lleva al formulario de alta a quien tenga el perfil a medias.
              Envuelve al router entero y no a cada ruta porque la decision
              es la misma en todas: la lista de excepciones vive dentro. */}
          <GuardiaPerfil>
            <AppRouter />
          </GuardiaPerfil>
        </main>

        <RailDerecho />
      </div>

      <BarraInferior noLeidos={noLeidos} />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      {/* Dentro del de sesión porque depende de quién sea: cuando no hay
          nadie no pide nada, y al salir se queda vacío. */}
      <ReaccionesProvider>
        <SeguimientosProvider>
          <Armazon />
        </SeguimientosProvider>
      </ReaccionesProvider>
    </AuthProvider>
  );
}

export default App;
