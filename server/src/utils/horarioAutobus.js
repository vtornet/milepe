import { ahoraEnMadrid, sumarDias } from './guardiaFarmacia.js';

// Cuentas de horarios de autobus, puras (sin base de datos) para poder
// probarlas. Todo en hora de Madrid y con minutos del dia, igual que las
// farmacias: asi el cambio de hora no entra nunca en la aritmetica.

export const aMinutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

export const sumarMinutos = (hora, minutos) => {
  const total = (aMinutos(hora) + minutos) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

// 'AAAA-MM-DD' -> 'laborables' | 'sabados' | 'domingos'. Los festivos no se
// conocen aqui (no hay calendario de festivos): un festivo entre semana sale
// como laborable, y la pagina lo advierte.
export const tipoDeDia = (dia) => {
  const semana = new Date(`${dia}T12:00:00Z`).getUTCDay();
  if (semana === 0) return 'domingos';
  if (semana === 6) return 'sabados';
  return 'laborables';
};

const DIAS_A_MIRAR = 7;

// Las proximas `cuantas` salidas de hoy a partir de ahora (incluida la de
// este mismo minuto) y, si hoy ya no queda ninguna, la primera del siguiente
// dia que tenga servicio (el urbano no circula el fin de semana).
export const proximasSalidas = (horarios, { cuantas = 3, ahora = ahoraEnMadrid() } = {}) => {
  const minutoActual = aMinutos(ahora.hora);
  const deHoy = (horarios?.[tipoDeDia(ahora.dia)] || [])
    .filter((h) => aMinutos(h) >= minutoActual)
    .slice(0, cuantas)
    .map((hora) => ({ hora, faltan_min: aMinutos(hora) - minutoActual }));

  let siguiente = null;
  if (deHoy.length === 0) {
    for (let i = 1; i <= DIAS_A_MIRAR; i += 1) {
      const dia = sumarDias(ahora.dia, i);
      const primera = horarios?.[tipoDeDia(dia)]?.[0];
      if (primera) {
        siguiente = { dia, hora: primera, es_manana: i === 1 };
        break;
      }
    }
  }
  return { hoy: deHoy, siguiente };
};
