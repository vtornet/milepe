// Fecha relativa ("hace 5 min") en vez de la fecha completa. En un feed es
// lo que se quiere leer: "hace 5 min" se entiende de un vistazo y
// "19/10/2026, 14:32" obliga a calcular. La fecha exacta sigue estando, en
// el title del <time>, para quien la necesite.
//
// Intl.RelativeTimeFormat lo hace el navegador: nada de una librería de
// fechas entera (date-fns, dayjs) para esto, que en una PWA son kilobytes
// que alguien descarga con los datos del móvil.
const relativo = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' });

const UNIDADES = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

export const haceCuanto = (iso) => {
  if (!iso) return '';

  const segundos = (Date.now() - new Date(iso).getTime()) / 1000;

  // Menos de un minuto no se cuenta en segundos: "hace 43 segundos" en un
  // feed es ruido, y además la cifra cambia mientras se lee.
  if (segundos < 60) return 'ahora mismo';

  for (const [unidad, enSegundos] of UNIDADES) {
    if (segundos >= enSegundos) {
      return relativo.format(-Math.floor(segundos / enSegundos), unidad);
    }
  }

  return 'ahora mismo';
};

export const fechaCompleta = (iso) =>
  iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' }) : '';

export const fechaCorta = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export const fechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '';

// Para la agenda de Eventos: "sáb 24 may, 20:30". El día de la semana
// importa en un evento y no en una publicación cualquiera.
export const fechaEvento = (iso) =>
  iso
    ? new Date(iso).toLocaleString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
