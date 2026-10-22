import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import CabeceraSeccion from '../../components/CabeceraSeccion.jsx';
import Icono from '../../components/Icono.jsx';
import { SECCIONES_TURISMO } from './seccionesTurismo.js';
import { redimensionada } from '../../utils/imagenes.js';

// Turismo es informacion, no un feed: una tarjeta por seccion y cada una
// lleva a su pagina. El contenido lo mantienen los administradores.
function TurismoPage() {
  const [datos, setDatos] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    api
      .get('/turismo/secciones')
      .then(({ data }) => {
        if (!cancelado) setDatos(Object.fromEntries(data.secciones.map((s) => [s.seccion, s])));
      })
      .catch(() => {
        // Sin los totales las tarjetas siguen sirviendo: solo falta el numero.
        if (!cancelado) setError('No se pudo cargar el recuento de cada sección.');
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <section>
      <CabeceraSeccion ruta="/turismo" descripcion="Qué ver, qué hacer y dónde comer o dormir en Lepe" />

      {error && (
        <div className="aviso aviso-error">
          <Icono nombre="alerta" tam={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="tarjetas-turismo">
        {SECCIONES_TURISMO.map((seccion) => {
          const total = datos[seccion.valor]?.total;
          const portada = datos[seccion.valor]?.portada;

          return (
            <Link
              key={seccion.valor}
              to={`/turismo/${seccion.valor}`}
              className="tarjeta tarjeta-pulsable tarjeta-seccion-turismo con-portada"
            >
              {/* Sin foto, la franja queda en el color de la marca: asi las siete
                  tarjetas tienen la misma estructura y no desentonan las vacias. */}
              <span className={`tarjeta-seccion-turismo-foto${portada ? '' : ' sin-foto'}`}>
                {portada && <img src={redimensionada(portada, 600)} alt="" loading="lazy" />}
              </span>
              <span className="tarjeta-seccion-turismo-icono" aria-hidden="true">
                <Icono nombre={seccion.icono} tam={26} />
              </span>
              <strong>{seccion.etiqueta}</strong>
              <span className="tarjeta-meta">{seccion.descripcion}</span>
              <span className="tarjeta-seccion-turismo-pie">
                {typeof total === 'number' && (
                  <span>
                    {total} {total === 1 ? 'recurso' : 'recursos'}
                  </span>
                )}
                <Icono nombre="siguiente" tam={18} className="tarjeta-seccion-turismo-flecha" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default TurismoPage;
