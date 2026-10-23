// Fechas y horarios de las guardias de farmacia. Todo se razona en hora de
// Madrid y con el dia como texto "AAAA-MM-DD", no como Date: una guardia es
// "el 3 de octubre", no un instante, y un Date guardado a medianoche cambia
// de dia segun la zona horaria del servidor (Railway corre en UTC).
//
// Cada guardia lleva su propia ventana (desde, hasta). Asi lo publica el
// Colegio: en Lepe, por ejemplo, tres farmacias de "diurno 9:30 a 22:00" y
// una de 24 horas. No hay un relevo global a una hora fija: de madrugada solo
// esta de guardia lo que tenga una ventana abierta, y una farmacia diurna del
// dia anterior esta CERRADA.

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_MES = /^\d{4}-\d{2}$/;
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DESDE_POR_DEFECTO = '00:00';
export const HASTA_POR_DEFECTO = '24:00';

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

// "09:30" -> true. La hora de inicio va de 00:00 a 23:59.
export const esHoraValida = (hora) => typeof hora === 'string' && FORMATO_HORA.test(hora);

// El fin admite ademas "24:00" (medianoche al terminar el dia), que es como
// se escribe "todo el dia".
export const esHoraFinValida = (hora) => hora === HASTA_POR_DEFECTO || esHoraValida(hora);

const minutosDeLaHora = (hora) => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

const MINUTOS_POR_DIA = 24 * 60;

const indiceDelDia = (dia) => Date.UTC(...dia.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n)))) / 86400000;

// Instante como minutos desde 1970, solo para comparar. No es un Date a
// proposito: asi no hay zona horaria ni horario de verano de por medio.
const instante = (dia, hora) => indiceDelDia(dia) * MINUTOS_POR_DIA + minutosDeLaHora(hora);

// Cuando empieza y acaba una guardia. Si el fin no es posterior al inicio, la
// guardia acaba al dia siguiente: "09:30 a 09:30" son 24 horas, y "22:00 a
// 09:30" una guardia de noche.
export const ventanaDeGuardia = ({ dia, desde = DESDE_POR_DEFECTO, hasta = HASTA_POR_DEFECTO }) => {
  const inicio = instante(dia, desde);
  let fin = instante(dia, hasta);
  if (fin <= inicio) fin += MINUTOS_POR_DIA;
  return { inicio, fin };
};

// ¿Esta la guardia en curso a esta hora? Una ventana dura como mucho 24 h,
// asi que basta mirar las guardias de ayer y de hoy.
export const estaEnCurso = (guardia, ahora = ahoraEnMadrid()) => {
  const { inicio, fin } = ventanaDeGuardia(guardia);
  const ya = instante(ahora.dia, ahora.hora);
  return inicio <= ya && ya < fin;
};
