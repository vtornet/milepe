// Fechas de las guardias de farmacia. Todo se razona en hora de Madrid y con
// el dia como texto "AAAA-MM-DD", no como Date: una guardia es "el 3 de
// octubre", no un instante, y un Date guardado a medianoche cambia de dia
// segun la zona horaria del servidor (Railway corre en UTC).

export const HORA_CAMBIO_POR_DEFECTO = '09:30';

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_MES = /^\d{4}-\d{2}$/;

// Fecha y hora de ahora en Madrid: { dia: 'AAAA-MM-DD', hora: 'HH:MM' }.
export const ahoraEnMadrid = (instante = new Date()) => {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instante)
      .map((p) => [p.type, p.value]),
  );

  return { dia: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` };
};

// Un dia de calendario real (rechaza 2026-02-30, que el formato por si solo
// dejaria pasar).
export const esDiaValido = (dia) => {
  if (typeof dia !== 'string' || !FORMATO_DIA.test(dia)) return false;
  const fecha = new Date(`${dia}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === dia;
};

export const esMesValido = (mes) =>
  typeof mes === 'string' && FORMATO_MES.test(mes) && Number(mes.slice(5)) >= 1 && Number(mes.slice(5)) <= 12;

export const sumarDias = (dia, dias) => {
  const fecha = new Date(`${dia}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

// "2026-10" -> { desde: '2026-10-01', hasta: '2026-10-31' }
export const limitesDelMes = (mes) => {
  const [anio, numero] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(anio, numero, 0)).getUTCDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` };
};

export const horaDeCambio = () => {
  const configurada = (process.env.FARMACIA_HORA_CAMBIO || '').trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(configurada) ? configurada : HORA_CAMBIO_POR_DEFECTO;
};

// A que dia de la lista corresponde ahora mismo. Una guardia de 24 horas no
// acaba a medianoche sino cuando abre la siguiente farmacia (aqui se asume
// que a las 09:30): a las 3 de la madrugada, la que esta de guardia es la
// del dia ANTERIOR, que es justo cuando mas gente la busca. Con la hora de
// cambio '00:00' se desactiva y manda el dia del calendario.
export const diaDeGuardia = (ahora = ahoraEnMadrid(), cambio = horaDeCambio()) =>
  ahora.hora < cambio ? sumarDias(ahora.dia, -1) : ahora.dia;
