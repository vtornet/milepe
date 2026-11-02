// Días festivos (no laborables) en Lepe, por año.
//
// No hay ninguna API que lo dé: los nacionales y autonómicos salen cada año
// en un decreto de la Junta en el BOJA (con los traslados de domingo a lunes
// ya decididos) y las dos fiestas locales, en una orden aparte que suele
// publicarse a final del año anterior. Se copian aquí a mano.
//
// - 2026: Decreto de la Junta para 2026 + fiestas locales de Lepe,
//   comprobado con tucalendariolaboral.com.
// - 2027: Decreto 84/2026 (BOJA de 5 de mayo de 2026). Las locales de Lepe
//   aún no se conocen: `localesPendientes` hace que la página lo diga en vez
//   de dar a entender que no hay.
//
// Para añadir un año: copiar el bloque, poner las 12 fechas del decreto y,
// cuando salgan, las dos locales (y quitar `localesPendientes`).
//
// ambito: 'nacional' | 'andalucia' | 'local'. Los traslados (Día de
// Andalucía en domingo, etc.) cuentan como autonómicos: es la Junta quien
// los decide.

export const AMBITOS = {
  nacional: 'Nacional',
  andalucia: 'Andalucía',
  local: 'Local',
};

export const FESTIVOS_LEPE = {
  2026: {
    fuente: 'https://www.tucalendariolaboral.com/comunidad/andalucia/ciudad/huelva/municipio/lepe',
    festivos: [
      { dia: '2026-01-01', nombre: 'Año Nuevo', ambito: 'nacional' },
      { dia: '2026-01-06', nombre: 'Epifanía del Señor', ambito: 'nacional' },
      { dia: '2026-02-28', nombre: 'Día de Andalucía', ambito: 'andalucia' },
      { dia: '2026-04-02', nombre: 'Jueves Santo', ambito: 'andalucia' },
      { dia: '2026-04-03', nombre: 'Viernes Santo', ambito: 'nacional' },
      { dia: '2026-05-01', nombre: 'Fiesta del Trabajo', ambito: 'nacional' },
      { dia: '2026-05-11', nombre: 'Fiesta local', ambito: 'local' },
      { dia: '2026-08-15', nombre: 'Asunción de la Virgen', ambito: 'nacional' },
      { dia: '2026-08-17', nombre: 'Fiesta local', ambito: 'local' },
      { dia: '2026-10-12', nombre: 'Fiesta Nacional de España', ambito: 'nacional' },
      { dia: '2026-11-02', nombre: 'Lunes siguiente a Todos los Santos', ambito: 'andalucia' },
      { dia: '2026-12-07', nombre: 'Lunes siguiente al Día de la Constitución', ambito: 'andalucia' },
      { dia: '2026-12-08', nombre: 'Inmaculada Concepción', ambito: 'nacional' },
      { dia: '2026-12-25', nombre: 'Natividad del Señor', ambito: 'nacional' },
    ],
  },
  2027: {
    fuente: 'https://www.juntadeandalucia.es/eboja/2026/84/BOJA26-084-00002-5812-01_00337048.pdf',
    localesPendientes: true,
    festivos: [
      { dia: '2027-01-01', nombre: 'Año Nuevo', ambito: 'nacional' },
      { dia: '2027-01-06', nombre: 'Epifanía del Señor', ambito: 'nacional' },
      { dia: '2027-03-01', nombre: 'Día de Andalucía (se pasa del domingo 28 de febrero)', ambito: 'andalucia' },
      { dia: '2027-03-25', nombre: 'Jueves Santo', ambito: 'andalucia' },
      { dia: '2027-03-26', nombre: 'Viernes Santo', ambito: 'nacional' },
      { dia: '2027-05-01', nombre: 'Fiesta del Trabajo', ambito: 'nacional' },
      { dia: '2027-08-16', nombre: 'Asunción de la Virgen (se pasa del domingo 15)', ambito: 'nacional' },
      { dia: '2027-10-12', nombre: 'Fiesta Nacional de España', ambito: 'nacional' },
      { dia: '2027-11-01', nombre: 'Todos los Santos', ambito: 'nacional' },
      { dia: '2027-12-06', nombre: 'Día de la Constitución', ambito: 'nacional' },
      { dia: '2027-12-08', nombre: 'Inmaculada Concepción', ambito: 'nacional' },
      { dia: '2027-12-25', nombre: 'Natividad del Señor', ambito: 'nacional' },
    ],
  },
};

export const ANIOS = Object.keys(FESTIVOS_LEPE).map(Number).sort();
