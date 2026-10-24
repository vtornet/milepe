import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api.js';
import Icono from './Icono.jsx';
import { Linea } from './Esqueleto.jsx';

// Columna derecha de escritorio: el tiempo de hoy y los teléfonos de
// urgencias. Las dos cosas ya existían, pero enterradas cada una en su
// página, y son justo las que un vecino quiere ver sin buscarlas. Esta
// columna es además lo que convierte "una lista centrada" en algo con la
// forma de una red social.
//
// Solo se monta en pantallas anchas (>=1240px, ver .rail en layout.css), de
// modo que estas dos peticiones no se hacen nunca en un móvil.
function RailDerecho() {
  const location = useLocation();
  const [tiempo, setTiempo] = useState(null);
  const [urgencias, setUrgencias] = useState([]);
  const [guardia, setGuardia] = useState(null);
  const [marea, setMarea] = useState(null);

  // En la propia página de El Tiempo (o de Contactos) su panel del rail
  // sería el mismo dato dos veces en la misma pantalla, que es justo lo que
  // hace que una columna lateral parezca relleno en vez de un resumen.
  const enTiempo = location.pathname.startsWith('/tiempo');
  const enContactos = location.pathname.startsWith('/contactos');
  const enFarmacias = location.pathname.startsWith('/farmacias');

  useEffect(() => {
    let cancelado = false;

    api
      .get('/tiempo')
      .then(({ data }) => {
        if (!cancelado) setTiempo(data.tiempo);
      })
      // Un fallo aquí no se enseña: es contenido secundario y un aviso de
      // error en la columna de al lado distrae de lo que se está leyendo.
      .catch(() => {});

    api
      .get('/contactos-interes')
      .then(({ data }) => {
        if (!cancelado) setUrgencias(data.contactos.filter((c) => c.categoria === 'otro').slice(0, 3));
      })
      .catch(() => {});

    api
      .get('/playa')
      .then(({ data }) => {
        if (!cancelado) setMarea(data.playa.proxima_marea);
      })
      .catch(() => {});

    api
      .get('/farmacias/guardia')
      .then(({ data }) => {
        if (!cancelado) setGuardia(data);
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <aside className="rail">
      {!enTiempo && (
        <section className="panel">
          <h2 className="panel-titulo">
            <Icono nombre="tiempo" tam={15} />
            El tiempo en Lepe
          </h2>
          <div className="panel-cuerpo">
            {!tiempo ? (
              <>
                <Linea ancho="55%" alto={30} />
                <Linea ancho="75%" />
              </>
            ) : (
              <>
                <div className="tiempo-actual">
                  {tiempo.actual.icono && (
                    <img
                      src={`https://openweathermap.org/img/wn/${tiempo.actual.icono}@2x.png`}
                      alt=""
                      width={56}
                      height={56}
                    />
                  )}
                  <div>
                    <div className="tiempo-temperatura">{tiempo.actual.temperatura}°</div>
                    <div className="tiempo-descripcion">{tiempo.actual.descripcion}</div>
                  </div>
                </div>

                {tiempo.proximos_dias?.length > 0 && (
                  <p className="tarjeta-meta" style={{ marginTop: 'var(--e-3)' }}>
                    Mañana {tiempo.proximos_dias[1]?.temp_max ?? tiempo.proximos_dias[0]?.temp_max}° /{' '}
                    {tiempo.proximos_dias[1]?.temp_min ?? tiempo.proximos_dias[0]?.temp_min}°
                  </p>
                )}

                {marea && (
                  <p className="tarjeta-meta">
                    Próxima {marea.tipo} en La Antilla: {marea.hora}
                  </p>
                )}

                <Link to="/tiempo" className="btn btn-plano btn-sm" style={{ marginTop: 'var(--e-2)' }}>
                  Ver la previsión
                </Link>
              </>
            )}
          </div>
        </section>
      )}

      {guardia && !enFarmacias && (
        <section className="panel">
          <h2 className="panel-titulo">
            <Icono nombre="farmacia" tam={15} />
            Farmacia de guardia
          </h2>
          <div className="panel-cuerpo pila">
            {guardia.en_curso.length > 0 ? (
              guardia.en_curso.map((farmacia) => (
                <div key={farmacia._id}>
                  <strong>{farmacia.nombre}</strong>
                  {farmacia.telefono && (
                    <a
                      href={`tel:${farmacia.telefono.split(/[/;,]/)[0].replace(/[^\d+]/g, '')}`}
                      className="fila"
                      style={{ textDecoration: 'none' }}
                    >
                      <Icono nombre="telefono" tam={14} /> {farmacia.telefono}
                    </a>
                  )}
                </div>
              ))
            ) : (
              <p className="tarjeta-meta">Ahora mismo no hay datos de guardia.</p>
            )}
            <Link to="/farmacias" className="btn btn-plano btn-sm">
              Ver las farmacias de guardia
            </Link>
          </div>
        </section>
      )}

      {urgencias.length > 0 && !enContactos && (
        <section className="panel">
          <h2 className="panel-titulo">
            <Icono nombre="telefono" tam={15} />
            Urgencias
          </h2>
          <div className="panel-cuerpo pila">
            {urgencias.map((contacto) => (
              <a
                key={contacto._id}
                href={`tel:${contacto.telefono.replace(/[^\d+]/g, '')}`}
                className="fila"
                style={{ textDecoration: 'none', justifyContent: 'space-between' }}
              >
                <span className="texto-suave">{contacto.nombre}</span>
                <strong>{contacto.telefono}</strong>
              </a>
            ))}
            <Link to="/contactos" className="btn btn-plano btn-sm">
              Todos los teléfonos
            </Link>
          </div>
        </section>
      )}

      <nav className="rail-pie">
        <Link to="/privacidad">Privacidad</Link>
        <Link to="/condiciones">Condiciones</Link>
      </nav>
      <p className="tarjeta-meta centrado">
        MiLepe · hecho en Lepe
        <br />
        Datos del tiempo de OpenWeather · mareas de Open-Meteo (CC BY 4.0)
      </p>
    </aside>
  );
}

export default RailDerecho;
