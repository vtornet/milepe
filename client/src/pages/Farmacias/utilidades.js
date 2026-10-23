// Mismo enum que server/src/models/Farmacia.js (ZONAS_FARMACIA).
export const ZONAS = {
  lepe: 'Lepe',
  la_antilla: 'La Antilla',
  islantilla: 'Islantilla',
  otra: 'Otra zona',
};

// Una farmacia puede tener dos telefonos ("959 48 65 73 / 959 40 01 26"): el
// enlace para marcar usa solo el primero; juntar los digitos de los dos daria
// un numero que no existe.
export const enlaceTelefono = (telefono) => `tel:${telefono.split(/[/;,]/)[0].replace(/[^\d+]/g, '')}`;

// Ruta hasta la farmacia en el mapa del móvil. Con coordenadas va derecho al
// punto; sin ellas, busca la dirección (peor, pero sirve).
export const enlaceComoLlegar = (farmacia) => {
  if (farmacia.ubicacion) {
    return `https://www.google.com/maps/dir/?api=1&destination=${farmacia.ubicacion.lat},${farmacia.ubicacion.lng}`;
  }
  const consulta = encodeURIComponent(`${farmacia.nombre}, ${farmacia.direccion}, Lepe, Huelva`);
  return `https://www.google.com/maps/search/?api=1&query=${consulta}`;
};

// "2026-10-03" -> "sábado 3 de octubre". Se construye a mediodía y en local
// para que el nombre del día no se desplace por la zona horaria.
export const etiquetaDia = (dia, { corto = false } = {}) => {
  const [anio, mes, numero] = dia.split('-').map(Number);
  return new Date(anio, mes - 1, numero, 12).toLocaleDateString('es-ES', {
    weekday: corto ? 'short' : 'long',
    day: 'numeric',
    month: corto ? undefined : 'long',
  });
};

// "2026-10" -> "octubre de 2026"
export const etiquetaMes = (mes) => {
  const [anio, numero] = mes.split('-').map(Number);
  return new Date(anio, numero - 1, 1, 12).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
};

const moverMes = (mes, delta) => {
  const [anio, numero] = mes.split('-').map(Number);
  const fecha = new Date(anio, numero - 1 + delta, 1, 12);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
};

export const mesAnterior = (mes) => moverMes(mes, -1);
export const mesSiguiente = (mes) => moverMes(mes, 1);

// --- Turnos ---

const sinCeroInicial = (hora) => hora.replace(/^0/, '');

// "00:00"-"24:00" -> "24 horas"; "09:30"-"22:00" -> "9:30–22:00". Si el fin
// coincide con el inicio (09:30 a 09:30) son 24 horas seguidas, pero que
// empiezan a esa hora: se dice.
export const etiquetaTurno = ({ desde, hasta }) => {
  if (desde === '00:00' && hasta === '24:00') return '24 horas';
  if (desde === hasta) return `24 horas (de ${sinCeroInicial(desde)} a ${sinCeroInicial(hasta)})`;
  return `${sinCeroInicial(desde)}–${sinCeroInicial(hasta)}`;
};

// Agrupa los turnos de un día por horario, manteniendo el orden que trae la
// API (por hora de inicio): [{ etiqueta, farmacias: [...] }].
export const agruparPorTurno = (turnos) => {
  const grupos = [];
  for (const turno of turnos) {
    const etiqueta = etiquetaTurno(turno);
    const grupo = grupos.find((g) => g.etiqueta === etiqueta);
    if (grupo) grupo.farmacias.push(turno);
    else grupos.push({ etiqueta, farmacias: [turno] });
  }
  return grupos;
};
