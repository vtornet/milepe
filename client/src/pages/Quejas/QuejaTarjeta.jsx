import TarjetaPublicacion, { Dato } from '../../components/TarjetaPublicacion.jsx';

// El estado de una queja es su dato mas importante: es lo que distingue
// "ya lo hemos dicho" de "esta en marcha". Por eso va con color y no como
// una insignia gris mas.
const ESTADOS = {
  pendiente: { etiqueta: 'Pendiente', clase: 'insignia-aviso' },
  en_curso: { etiqueta: 'En curso', clase: 'insignia-info' },
  resuelto: { etiqueta: 'Resuelto', clase: 'insignia-exito' },
};

const ETIQUETA_CATEGORIA = {
  limpieza: 'Limpieza',
  alumbrado: 'Alumbrado',
  via_publica: 'Vía pública',
  zonas_verdes: 'Zonas verdes',
  ruido: 'Ruido',
  otro: 'Otro',
};

function QuejaTarjeta({ queja }) {
  const estado = ESTADOS[queja.estado] || { etiqueta: queja.estado, clase: '' };

  return (
    <TarjetaPublicacion
      post={queja}
      chips={
        <>
          <span className={`insignia ${estado.clase}`}>{estado.etiqueta}</span>
          <span className="insignia">{ETIQUETA_CATEGORIA[queja.categoria] || queja.categoria}</span>
        </>
      }
      datos={<Dato icono="ubicacion">{queja.direccion_aproximada}</Dato>}
    />
  );
}

export default QuejaTarjeta;
