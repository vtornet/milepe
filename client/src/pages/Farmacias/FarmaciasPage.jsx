import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import CabeceraSeccion from '../../components/CabeceraSeccion.jsx';
import Icono from '../../components/Icono.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import FarmaciasAdmin from './FarmaciasAdmin.jsx';
import { etiquetaDia, etiquetaMes, mesAnterior, mesSiguiente, ZONAS, enlaceComoLlegar, enlaceTelefono } from './utilidades.js';

// Donde el Colegio publica el cuadro oficial. Es la fuente de todo lo que
// se ve aquí y el sitio al que mandar cuando los datos de MiLepe no llegan.
const CUADRO_OFICIAL = 'https://cofhuelva.org/cuadro-de-guardias';

// "Hasta las 09:30 de mañana" o, de madrugada, "hasta las 09:30 de hoy".
const hastaCuando = (guardia, ahora, cambio) =>
  guardia.dia === ahora.dia ? `hasta las ${cambio} de mañana` : `hasta las ${cambio} de hoy`;

function TarjetaFarmacia({ farmacia }) {
  return (
    <article className="tarjeta">
      <strong>{farmacia.nombre}</strong>
      {farmacia.nota && <div className="tarjeta-meta">{farmacia.nota}</div>}

      <div className="telefonos-contacto">
        {farmacia.telefono && (
          <a className="telefono-principal" href={enlaceTelefono(farmacia.telefono)}>
            <Icono nombre="telefono" tam={16} /> {farmacia.telefono}
          </a>
        )}
        {(farmacia.ubicacion || farmacia.direccion) && (
          <a href={enlaceComoLlegar(farmacia)} target="_blank" rel="noreferrer">
            <Icono nombre="ubicacion" tam={16} /> Cómo llegar
          </a>
        )}
      </div>

      {farmacia.direccion && (
        <div className="tarjeta-meta">
          <Icono nombre="ubicacion" tam={14} /> {farmacia.direccion} · {ZONAS[farmacia.zona] || ''}
        </div>
      )}
      {farmacia.horario && (
        <div className="tarjeta-meta">
          <Icono nombre="reloj" tam={14} /> {farmacia.horario}
        </div>
      )}
    </article>
  );
}

// Lo que se dice cuando no hay farmacias para un día. Distinguir las tres
// causas importa: «no hay guardia» sería falso casi siempre, lo real es que
// los datos no están, y quien busca una farmacia a las tres de la madrugada
// necesita saber que tiene que mirar otra fuente.
function SinDatos({ guardia, calendarioHasta }) {
  let motivo;
  if (!calendarioHasta) {
    motivo = 'Todavía no hay ningún calendario de guardias cargado en MiLepe.';
  } else if (calendarioHasta < guardia.dia) {
    motivo = `El calendario cargado en MiLepe llega hasta el ${etiquetaDia(calendarioHasta)}.`;
  } else {
    motivo = 'No hay ninguna guardia anotada para este día en el calendario de MiLepe.';
  }

  return (
    <div className="aviso aviso-info">
      <Icono nombre="alerta" tam={18} />
      <span>
        {motivo}{' '}
        <a href={CUADRO_OFICIAL} target="_blank" rel="noreferrer">
          Consulta el cuadro oficial del Colegio de Farmacéuticos
        </a>
        .
      </span>
    </div>
  );
}

function FarmaciasPage() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';

  const [guardia, setGuardia] = useState(null);
  const [farmacias, setFarmacias] = useState([]);
  const [mes, setMes] = useState(null);
  const [dias, setDias] = useState([]);
  const [error, setError] = useState(null);

  const cargarGuardia = useCallback(async () => {
    const { data } = await api.get('/farmacias/guardia');
    setGuardia(data);
    return data;
  }, []);

  const cargarDirectorio = useCallback(async () => {
    const { data } = await api.get('/farmacias');
    setFarmacias(data.farmacias);
  }, []);

  const cargarMes = useCallback(async (mesElegido) => {
    const { data } = await api.get('/farmacias/guardias', { params: { mes: mesElegido } });
    setDias(data.dias);
  }, []);

  useEffect(() => {
    let cancelado = false;

    Promise.all([cargarGuardia(), cargarDirectorio()])
      .then(([datos]) => {
        if (!cancelado) setMes(datos.actual.dia.slice(0, 7));
      })
      .catch(() => {
        if (!cancelado) setError('No se pudieron cargar las farmacias de guardia.');
      });

    return () => {
      cancelado = true;
    };
  }, [cargarGuardia, cargarDirectorio]);

  useEffect(() => {
    if (!mes) return;
    cargarMes(mes).catch(() => setDias([]));
  }, [mes, cargarMes]);

  // Tras cargar un calendario o cambiar una farmacia en el panel de admin,
  // se vuelve a pedir todo: la tarjeta de «ahora» puede haber cambiado.
  const recargar = useCallback(() => {
    cargarGuardia().catch(() => {});
    cargarDirectorio().catch(() => {});
    if (mes) cargarMes(mes).catch(() => {});
  }, [cargarGuardia, cargarDirectorio, cargarMes, mes]);

  return (
    <section>
      <CabeceraSeccion
        ruta="/farmacias"
        descripcion="Qué farmacia está de guardia en Lepe, La Antilla e Islantilla."
      />

      {error && (
        <div className="aviso aviso-error">
          <Icono nombre="alerta" tam={18} />
          <span>{error}</span>
        </div>
      )}
      {!guardia && !error && <EsqueletoFeed />}

      {guardia && (
        <>
          <h2 className="contactos-titulo">
            <span className="contactos-titulo-icono" aria-hidden="true">
              <Icono nombre="farmacia" tam={18} />
            </span>
            De guardia ahora
          </h2>
          <p className="tarjeta-meta">
            {etiquetaDia(guardia.actual.dia)}, {hastaCuando(guardia.actual, guardia.ahora, guardia.cambio)}
          </p>

          {guardia.actual.farmacias.length > 0 ? (
            guardia.actual.farmacias.map((f) => <TarjetaFarmacia key={f._id} farmacia={f} />)
          ) : (
            <SinDatos guardia={guardia.actual} calendarioHasta={guardia.calendario_hasta} />
          )}

          {guardia.siguiente.farmacias.length > 0 && (
            <>
              <h2 className="contactos-titulo">Siguiente relevo</h2>
              <p className="tarjeta-meta">
                {etiquetaDia(guardia.siguiente.dia)}, desde las {guardia.cambio}
              </p>
              {guardia.siguiente.farmacias.map((f) => (
                <TarjetaFarmacia key={f._id} farmacia={f} />
              ))}
            </>
          )}

          <p className="tarjeta-meta" style={{ marginTop: 'var(--e-4)' }}>
            Estos datos los anota a mano el equipo de MiLepe a partir del{' '}
            <a href={CUADRO_OFICIAL} target="_blank" rel="noreferrer">
              cuadro oficial del Colegio de Farmacéuticos de Huelva
            </a>
            . Ante la duda, llama a la farmacia antes de ir.
          </p>
        </>
      )}

      {mes && (
        <>
          <h2 className="contactos-titulo">Calendario del mes</h2>
          <div className="fila" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-contorno btn-sm" onClick={() => setMes(mesAnterior(mes))}>
              <Icono nombre="atras" tam={14} /> Anterior
            </button>
            <strong>{etiquetaMes(mes)}</strong>
            <button type="button" className="btn btn-contorno btn-sm" onClick={() => setMes(mesSiguiente(mes))}>
              Siguiente
            </button>
          </div>

          {dias.length === 0 ? (
            <p className="tarjeta-meta">No hay guardias cargadas para este mes.</p>
          ) : (
            <div className="tarjeta pila">
              {dias.map((d) => (
                <div
                  key={d.dia}
                  className="fila"
                  style={{
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    fontWeight: guardia?.actual.dia === d.dia ? 700 : undefined,
                  }}
                >
                  <span>{etiquetaDia(d.dia, { corto: true })}</span>
                  <span style={{ textAlign: 'right' }}>
                    {d.farmacias.map((f) => (
                      <div key={f._id}>
                        {f.nombre}
                        {f.nota ? ` (${f.nota})` : ''}
                      </div>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {farmacias.length > 0 && (
        <>
          <h2 className="contactos-titulo">Todas las farmacias</h2>
          {farmacias.map((f) => (
            <TarjetaFarmacia key={f._id} farmacia={f} />
          ))}
        </>
      )}

      {esAdmin && <FarmaciasAdmin mes={mes} onCambio={recargar} />}
    </section>
  );
}

export default FarmaciasPage;
