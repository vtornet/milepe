import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import Icono from '../../components/Icono.jsx';
import PlayaHoy from './PlayaHoy.jsx';
import { useTitulo } from '../../hooks/useTitulo.js';

// Los iconos de OpenWeather son publicos (no llevan clave), asi que se
// pueden pedir directamente desde el navegador.
const urlIcono = (icono) => `https://openweathermap.org/img/wn/${icono}@2x.png`;

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const nombreDia = (fechaISO) => {
  // "2026-10-20" -> se construye en local a mediodia para que el nombre
  // del dia no se desplace por zona horaria.
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia, 12);
  const hoy = new Date();
  const esHoy = fecha.toDateString() === hoy.toDateString();
  return esHoy ? 'Hoy' : DIAS[fecha.getDay()];
};

function TiempoPage() {
  useTitulo('El Tiempo');
  const [tiempo, setTiempo] = useState(null);
  const [obsoleto, setObsoleto] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    api
      .get('/tiempo')
      .then(({ data }) => {
        if (cancelado) return;
        setTiempo(data.tiempo);
        setObsoleto(Boolean(data.obsoleto));
      })
      .catch((err) => {
        if (!cancelado) setError(err.response?.data?.mensaje || 'No se pudo cargar el tiempo.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  if (cargando) return <p>Cargando el tiempo...</p>;
  if (error) return <p className="mensaje-error">{error}</p>;

  return (
    <section>
      <h1>El Tiempo en {tiempo.municipio}</h1>

      {obsoleto && (
        <p className="tarjeta-meta">
          <Icono nombre="alerta" tam={14} /> No se ha podido contactar con el servicio meteorológico ahora mismo; estos son los últimos datos
          disponibles.
        </p>
      )}

      <article className="tarjeta tiempo-actual">
        {tiempo.actual.icono && <img src={urlIcono(tiempo.actual.icono)} alt={tiempo.actual.descripcion} />}
        <div>
          <div className="tiempo-temperatura">{tiempo.actual.temperatura}°</div>
          <div className="tiempo-descripcion">{tiempo.actual.descripcion}</div>
          <div className="tarjeta-meta">
            Sensación {tiempo.actual.sensacion}° · <Icono nombre="gota" tam={14} /> {tiempo.actual.humedad}% ·{' '}
            <Icono nombre="viento" tam={14} /> {tiempo.actual.viento_kmh} km/h
          </div>
        </div>
      </article>

      <h2>Próximos días</h2>
      <div className="tiempo-dias">
        {tiempo.proximos_dias.map((dia) => (
          <article key={dia.fecha} className="tarjeta tiempo-dia">
            <strong>{nombreDia(dia.fecha)}</strong>
            {dia.icono && <img src={urlIcono(dia.icono)} alt={dia.descripcion} />}
            <div>
              <strong>{dia.temp_max}°</strong> <span className="tarjeta-meta">{dia.temp_min}°</span>
            </div>
            <div className="tarjeta-meta">{dia.descripcion}</div>
          </article>
        ))}
      </div>

      <p className="tarjeta-meta">
        Actualizado: {new Date(tiempo.actualizado).toLocaleString('es-ES')} · Datos de OpenWeather
      </p>

      <PlayaHoy />
    </section>
  );
}

export default TiempoPage;
