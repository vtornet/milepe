// Convierte el texto que pega un admin (copiado del cuadro mensual del
// Colegio de Farmacéuticos) en la lista que espera
// PUT /api/farmacias/guardias/:mes.
//
// Una guardia por línea: fecha, farmacia y, si hace falta, una nota,
// separadas por punto y coma, tabulador, barra vertical o coma:
//
//   2026-10-03;Farmacia Pérez
//   03/10/2026;Farmacia La Antilla;De 9:30 a 22:00
//   4/10/2026<TAB>Farmacia Pérez
//
// Admite fechas AAAA-MM-DD y D/M/AAAA (también con . o -). Se ignoran las
// líneas vacías y una cabecera ("fecha;farmacia"). Lo que no se entiende no
// se descarta en silencio: se devuelve en `errores` con su número de línea,
// porque una guardia perdida es una farmacia que no sale cuando alguien la
// necesita.
//
// No hace falta que el nombre coincida letra por letra con el del
// directorio (el servidor ignora tildes, mayúsculas y espacios de más), pero
// sí que exista allí: de eso se encarga el servidor.

const LINEA = /^\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s*[;,\t|]\s*([^;\t|]+?)\s*(?:[;\t|]\s*(.+?))?\s*$/;

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

export const interpretarCalendario = (texto) => {
  const guardias = [];
  const errores = [];

  String(texto)
    .split(/\r?\n/)
    .forEach((linea, indice) => {
      if (!linea.trim()) return;
      if (/^\s*(fecha|d[ií]a)\b/i.test(linea)) return;

      const coincidencia = LINEA.exec(linea);
      if (!coincidencia) {
        errores.push(`Línea ${indice + 1}: no entiendo «${linea.trim().slice(0, 60)}»`);
        return;
      }

      const [, fecha, farmacia, nota] = coincidencia;
      guardias.push({ dia: aDiaISO(fecha), farmacia, ...(nota ? { nota } : {}) });
    });

  return { guardias, errores };
};
