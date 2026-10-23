// Convierte el texto que pega un admin (copiado del cuadro mensual del
// Colegio de Farmacéuticos) en la lista que espera
// PUT /api/farmacias/guardias/:mes.
//
// El cuadro de Lepe NO es un calendario día a día, es un patrón semanal con
// horarios ("DIURNO 9:30 a 22:00, de lunes a viernes: A, B, C; sábados: A, C;
// domingos y festivos: A; 24 horas: D"), así que aquí se pueden escribir las
// dos cosas. Una guardia por línea, separada por punto y coma, tabulador o
// barra vertical:
//
//   Guardia con fecha:   2026-10-03;Farmacia Pérez;9:30-22:00
//                        3/10/2026;Farmacia Pérez
//   Patrón semanal:      L-V;Farmacia Pérez;9:30-22:00
//                        S;Farmacia Pérez;9:30-22:00
//                        todos;Farmacia Vacas;24h
//   Festivos del mes:    festivo;2026-10-12
//
// Días de un patrón: L-V, S, D, festivos, todos (los cuatro), y combinaciones
// L-S, L-D o con "+" (S+D). Un día festivo usa SOLO las líneas "festivos" y
// "todos", no las de su día de la semana: un lunes 12 de octubre no tiene la
// guardia de los lunes.
//
// Tercera columna: el horario ("9:30-22:00", "de 9:30 a 22:00", "24h") o, si
// no lo parece, una nota. Sin ella, la guardia vale todo el día.
//
// Lo que no se entiende no se descarta en silencio: se devuelve en `errores`
// con su número de línea, porque una guardia perdida es una farmacia que no
// sale cuando alguien la necesita. No hace falta que el nombre de la farmacia
// coincida letra por letra con el del directorio (el servidor entiende
// incluso "Farmacia Lda. Mª Esperanza Sanchez Martín (C/ Alcalde César
// Barrios, 2)"), pero sí que exista allí.

const FECHA = '\\d{4}-\\d{1,2}-\\d{1,2}|\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4}';
const ES_FECHA = new RegExp(`^(${FECHA})$`);
const LINEA_FECHA_CON_COMA = new RegExp(`^\\s*(${FECHA})\\s*,\\s*(.+)$`);

const dosCifras = (n) => String(n).padStart(2, '0');

// "3/10/2026" -> "2026-10-03"; "2026-10-3" -> "2026-10-03". No comprueba que
// el día exista (2026-02-30): eso lo rechaza el servidor con su mensaje.
export const aDiaISO = (texto) => {
  let anio;
  let mes;
  let dia;

  if (/^\d{4}-/.test(texto)) {
    [anio, mes, dia] = texto.split('-');
  } else {
    [dia, mes, anio] = texto.split(/[/.-]/);
  }

  return `${anio}-${dosCifras(Number(mes))}-${dosCifras(Number(dia))}`;
};

const sinTildes = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// --- Horario ---

const hora = (h, m) => `${dosCifras(Number(h))}:${m}`;

// "9:30-22:00", "de 9:30 a 22:00", "24h", "24 horas" -> { desde, hasta }; si
// no es un horario, null (y la columna se toma como nota).
export const interpretarHorario = (texto) => {
  const t = sinTildes(texto);

  if (/^(24\s*h(oras?)?|todo el dia|las 24 horas)$/.test(t)) return { desde: '00:00', hasta: '24:00' };

  const m = /^(?:de\s+)?(\d{1,2}):(\d{2})\s*(?:-|a|–|—)\s*(\d{1,2}):(\d{2})(?:\s*h(?:oras?)?)?$/.exec(t);
  if (!m) return null;

  return { desde: hora(m[1], m[2]), hasta: hora(m[3], m[4]) };
};

// --- Días de un patrón ---

const TIPOS = ['lv', 's', 'd', 'f'];

const POR_PALABRA = [
  [/^(l-?v|lunes a viernes|laborables)$/, ['lv']],
  [/^(s|sab|sabado|sabados)$/, ['s']],
  [/^(d|dom|domingo|domingos)$/, ['d']],
  [/^(f|festivo|festivos)$/, ['f']],
  [/^(l-?s)$/, ['lv', 's']],
  [/^(l-?d)$/, ['lv', 's', 'd']],
  [/^(todos|todo|diario|todos los dias)$/, TIPOS],
];

// "L-V", "S+D", "festivos"... -> ['lv'], ['s','d'], ['f']; null si no lo es.
const tiposDeDias = (texto) => {
  const tipos = new Set();
  for (const parte of sinTildes(texto).split('+')) {
    const encontrado = POR_PALABRA.find(([patron]) => patron.test(parte.trim()));
    if (!encontrado) return null;
    encontrado[1].forEach((t) => tipos.add(t));
  }
  return tipos;
};

const diasDelMes = (mes) => {
  const [anio, numero] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(anio, numero, 0)).getUTCDate();
  return Array.from({ length: ultimo }, (_, i) => `${mes}-${dosCifras(i + 1)}`);
};

const tipoDelDia = (dia, festivos) => {
  if (festivos.has(dia)) return 'f';
  const semana = new Date(`${dia}T00:00:00Z`).getUTCDay();
  if (semana === 0) return 'd';
  if (semana === 6) return 's';
  return 'lv';
};

// --- Interpretacion ---

const campos = (linea) => {
  if (/[;\t|]/.test(linea)) return linea.split(/[;\t|]/).map((c) => c.trim());

  // Compatibilidad: "2026-10-04,Farmacia Pérez" (coma tras una fecha).
  const conComa = LINEA_FECHA_CON_COMA.exec(linea);
  return conComa ? [conComa[1], conComa[2].trim()] : [linea.trim()];
};

const completar = (base, tercera) => {
  if (!tercera) return base;
  const horario = interpretarHorario(tercera);
  return horario ? { ...base, ...horario } : { ...base, nota: tercera };
};

export const interpretarCalendario = (texto, mes) => {
  const sueltas = [];
  const patrones = [];
  const festivos = new Set();
  const errores = [];

  String(texto)
    .split(/\r?\n/)
    .forEach((linea, indice) => {
      if (!linea.trim()) return;
      if (/^\s*(fecha|d[ií]a)\b/i.test(linea)) return;

      const [primero, segundo, tercero] = campos(linea);
      const numero = `Línea ${indice + 1}`;
      const recorte = linea.trim().slice(0, 60);

      if (ES_FECHA.test(primero ?? '')) {
        if (!segundo) {
          errores.push(`${numero}: falta la farmacia en «${recorte}»`);
          return;
        }
        sueltas.push(completar({ dia: aDiaISO(primero), farmacia: segundo }, tercero));
        return;
      }

      if (/^festivos?$/.test(sinTildes(primero ?? '')) && ES_FECHA.test(segundo ?? '')) {
        festivos.add(aDiaISO(segundo));
        return;
      }

      const tipos = tiposDeDias(primero ?? '');
      if (tipos && segundo) {
        patrones.push({ tipos, farmacia: segundo, tercero });
        return;
      }

      errores.push(`${numero}: no entiendo «${recorte}»`);
    });

  let expandidas = [];
  if (patrones.length > 0) {
    if (!mes) {
      errores.push('Hay líneas de patrón semanal (L-V, S, D...) pero no se ha elegido el mes.');
    } else {
      for (const festivo of festivos) {
        if (!festivo.startsWith(`${mes}-`)) errores.push(`El festivo ${festivo} no es de ${mes}`);
      }
      expandidas = diasDelMes(mes).flatMap((dia) => {
        const tipo = tipoDelDia(dia, festivos);
        return patrones
          .filter((p) => p.tipos.has(tipo))
          .map((p) => completar({ dia, farmacia: p.farmacia }, p.tercero));
      });
    }
  }

  return { guardias: [...sueltas, ...expandidas], errores };
};
