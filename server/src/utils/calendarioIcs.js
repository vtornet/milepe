// Un evento en formato iCalendar (RFC 5545), para "Añadir al calendario":
// lo abren el calendario del movil, Google Calendar y Outlook. Sin libreria:
// es texto con tres reglas que hay que cumplir y que se prueban aqui.

// Texto: \ ; , y saltos de linea van escapados (seccion 3.3.11).
export const escaparTexto = (texto = '') =>
  String(texto).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Fechas en UTC con Z: asi no hace falta declarar la zona horaria y cada
// calendario lo muestra en la hora local de quien lo abre.
export const fechaIcs = (fecha) => new Date(fecha).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// Lineas de mas de 75 octetos se parten y la continuacion empieza con un
// espacio (seccion 3.1). Se cuenta en bytes UTF-8, no en caracteres: una ñ
// son dos.
export const plegarLinea = (linea) => {
  const partes = [];
  let actual = '';
  let bytes = 0;
  for (const caracter of linea) {
    const tam = Buffer.byteLength(caracter, 'utf8');
    const limite = partes.length === 0 ? 75 : 74; // la continuacion lleva el espacio delante
    if (bytes + tam > limite) {
      partes.push(actual);
      actual = '';
      bytes = 0;
    }
    actual += caracter;
    bytes += tam;
  }
  partes.push(actual);
  return partes.join('\r\n ');
};

const DOS_HORAS = 2 * 60 * 60 * 1000;

export const eventoAIcs = ({ id, titulo, descripcion, lugar, inicio, fin, url }) => {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MiLepe//Eventos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${id}@milepe.com`,
    `DTSTAMP:${fechaIcs(new Date())}`,
    `DTSTART:${fechaIcs(inicio)}`,
    // Sin fecha de fin, dos horas: un evento sin final se pinta como de 0
    // minutos en casi todos los calendarios.
    `DTEND:${fechaIcs(fin || new Date(new Date(inicio).getTime() + DOS_HORAS))}`,
    `SUMMARY:${escaparTexto(titulo)}`,
    `DESCRIPTION:${escaparTexto(descripcion)}`,
    `LOCATION:${escaparTexto(lugar)}`,
    ...(url ? [`URL:${url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lineas.map(plegarLinea).join('\r\n')}\r\n`;
};
