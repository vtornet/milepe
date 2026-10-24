import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Icono from '../../components/Icono.jsx';
import TarjetaPublicacion, { Dato } from '../../components/TarjetaPublicacion.jsx';
import { fechaEvento } from '../../utils/fechas.js';

const ETIQUETA_CATEGORIA = {
  feria: 'Feria',
  fiesta_patronal: 'Fiesta patronal',
  concierto: 'Concierto',
  deportivo: 'Deportivo',
  cultural: 'Cultural',
  otro: 'Otro',
};

// El .ics lo sirve la API, así que el enlace va a su dominio, no al de la web.
const urlCalendario = (id) => `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/eventos/${id}/calendario.ics`;

function EventoTarjeta({ evento, voyInicial = false }) {
  const { usuario } = useAuth();
  const [voy, setVoy] = useState(voyInicial);
  const [asistentes, setAsistentes] = useState(evento.asistentes || 0);
  const [aviso, setAviso] = useState(null);

  // La lista de "a los que voy" llega después que los eventos.
  useEffect(() => setVoy(voyInicial), [voyInicial]);

  const alternar = async () => {
    if (!usuario) {
      setAviso('Inicia sesión para apuntarte.');
      return;
    }
    setAviso(null);
    try {
      const { data } = await api.post(`/eventos/${evento._id}/asistir`);
      setVoy(data.voy);
      setAsistentes(data.asistentes);
    } catch (err) {
      setAviso(err.response?.data?.mensaje || 'No se pudo guardar');
    }
  };

  const yaPaso = evento.fecha_fin
    ? new Date(evento.fecha_fin) < new Date()
    : new Date(evento.fecha_inicio) < new Date();

  return (
    <TarjetaPublicacion
      post={evento}
      chips={
        <>
          <span className="insignia">{ETIQUETA_CATEGORIA[evento.categoria] || evento.categoria}</span>
          {evento.patrocinado && (
            <span className="insignia insignia-destacado">
              Patrocinado{evento.patrocinador_nombre ? ` · ${evento.patrocinador_nombre}` : ''}
            </span>
          )}
          {/* Marcar lo ya celebrado importa porque la agenda puede mostrar
              el historial con ?incluirPasados=true. */}
          {yaPaso && <span className="insignia">Ya celebrado</span>}
        </>
      }
      datos={
        <>
          <Dato icono="eventos">
            {fechaEvento(evento.fecha_inicio)}
            {evento.fecha_fin && ` — ${fechaEvento(evento.fecha_fin)}`}
          </Dato>
          <Dato icono="ubicacion">{evento.lugar}</Dato>
          {asistentes > 0 && <Dato icono="perfil">{asistentes === 1 ? 'Va 1 persona' : `Van ${asistentes} personas`}</Dato>}
        </>
      }
      acciones={
        !yaPaso && (
          <>
            <button type="button" className={`accion${voy ? ' activa' : ''}`} onClick={alternar} aria-pressed={voy}>
              <Icono nombre="comprobado" tam={18} />
              {voy ? 'Voy' : 'Voy a ir'}
            </button>
            <a className="accion" href={urlCalendario(evento._id)}>
              <Icono nombre="eventos" tam={18} />
              Añadir al calendario
            </a>
          </>
        )
      }
    >
      {aviso && <p className="tarjeta-meta">{aviso}</p>}
    </TarjetaPublicacion>
  );
}

export default EventoTarjeta;
