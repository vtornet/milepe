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

function EventoTarjeta({ evento }) {
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
        </>
      }
    />
  );
}

export default EventoTarjeta;
