// Juego de iconos propio, en SVG inline. Sin librería de iconos a
// propósito: react-icons o lucide-react traen miles de iconos de los que
// aquí se usan treinta, y en una PWA que alguien instala con los datos del
// móvil eso son kilobytes regalados. Todos son de trazo, 24x24, con el
// mismo grosor, que es lo que hace que un juego de iconos se vea como un
// juego y no como una colección de emojis.
//
// `currentColor` en el trazo es deliberado: así un icono hereda el color
// del enlace o del botón que lo contiene y no hay que pasarle ninguno.
const TRAZOS = {
  muro: ['M3 10.5 12 3l9 7.5', 'M5 9.5V20h14V9.5', 'M9.5 20v-6h5v6'],
  quejas: ['M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z', 'M16 8.5a5 5 0 0 1 0 7', 'M19 6a9 9 0 0 1 0 12'],
  turismo: ['M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z', 'M12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  fotos: [
    'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
    'M3 16l4.5-4.5a1.5 1.5 0 0 1 2 0L14 16',
    'M13.5 14l1.8-1.8a1.5 1.5 0 0 1 2 0L21 15.5',
    'M15.5 9.5h.01',
  ],
  eventos: ['M4 6h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z', 'M3 11h18', 'M8 4v4', 'M16 4v4'],
  tiempo: [
    'M8.5 18a4.5 4.5 0 0 1-.4-8.98A5.5 5.5 0 0 1 18.4 10.2 3.9 3.9 0 0 1 17.6 18Z',
    'M15 5.5 15.8 4',
    'M19.5 8.2 21 7.6',
    'M11.2 4.4 10.6 3',
  ],
  empleo: [
    'M4 8h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z',
    'M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
    'M3 13h18',
  ],
  negocios: [
    'M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9',
    'M3 10 5 5h14l2 5',
    'M3 10h18',
    'M10 20v-5h4v5',
  ],
  contactos: ['M7 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 5 7.7 2 2 0 0 1 7 3.5Z'],
  mensajes: ['M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z'],
  moderacion: ['M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6l8-3Z', 'M9 12l2 2 4-4'],
  perfil: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4.5 20a7.5 7.5 0 0 1 15 0'],
  mas: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  rejilla: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  buscar: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'M20 20l-4-4'],
  sol: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19'],
  luna: ['M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z'],
  salir: ['M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3', 'M10 8l-4 4 4 4', 'M6 12h9'],
  entrar: ['M9 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3', 'M14 8l4 4-4 4', 'M18 12H9'],
  comentario: ['M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z'],
  corazon: ['M12 20s-7-4.3-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.7 12 20 12 20Z'],
  bandera: ['M5 21V4', 'M5 4h11l-1.5 4L16 12H5'],
  lapiz: ['M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z', 'M14 7l3 3'],
  papelera: ['M4 7h16', 'M9 7V4.5h6V7', 'M6.5 7l1 13h9l1-13', 'M10 11v5', 'M14 11v5'],
  historial: ['M12 8v4.5l3 1.8', 'M3.5 12a8.5 8.5 0 1 0 2.7-6.2', 'M3 4.5v4h4'],
  mas_circulo: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 8v8', 'M8 12h8'],
  anadir: ['M12 5v14', 'M5 12h14'],
  reloj: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7.5V12l3 2'],
  ubicacion: ['M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z', 'M12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  euro: ['M17 6.5A6 6 0 1 0 17 17.5', 'M4 10h8', 'M4 14h8'],
  enlace: ['M10 13a4 4 0 0 0 5.7 0l2.6-2.6A4 4 0 0 0 12.6 4.7L11 6.3', 'M14 11a4 4 0 0 0-5.7 0l-2.6 2.6A4 4 0 0 0 11.4 19.3L13 17.7'],
  estrella: ['M12 3.8l2.6 5.3 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.9l5.9-.8L12 3.8Z'],
  atras: ['M14 7l-5 5 5 5'],
  alerta: ['M12 3.5 21 19H3l9-15.5Z', 'M12 9.5v4', 'M12 16.5h.01'],
  campana: ['M12 4a5.5 5.5 0 0 0-5.5 5.5c0 4-1.5 5.5-1.5 5.5h14s-1.5-1.5-1.5-5.5A5.5 5.5 0 0 0 12 4Z', 'M10 18a2 2 0 0 0 4 0'],
  telefono: ['M7 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 5 7.7 2 2 0 0 1 7 3.5Z'],
  cerrar: ['M6 6l12 12', 'M18 6 6 18'],
  enviar: ['M4 12l16-7-7 16-2.5-6.5L4 12Z'],
  comprobado: ['M4 12.5l5 5L20 6.5'],

  // Turismo
  playa: ['M8.5 12.5a3.5 3.5 0 0 1 7 0', 'M12 4v1.8', 'M5.6 6.6l1.2 1.2', 'M18.4 6.6l-1.2 1.2', 'M3.5 12.5H5.5', 'M18.5 12.5h2', 'M3 16c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0', 'M3 20c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0'],
  bici: ['M3 16.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0Z', 'M14 16.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0Z', 'M6.5 16.5 10 9h5l2.5 7.5', 'M10 9 9 6.5H7', 'M14 6.5h2.5'],
  cultura: ['M3 9.5 12 4l9 5.5', 'M5.5 11v7', 'M10 11v7', 'M14 11v7', 'M18.5 11v7', 'M3.5 20.5h17'],
  cubiertos: ['M7 3v6a2 2 0 0 0 4 0V3', 'M9 3v18', 'M17 21V3c-2 1.2-3.5 4-3.5 8 0 1.8 1.2 2.7 3.5 2.7'],
  cama: ['M3 19V6', 'M21 19v-5a3 3 0 0 0-3-3h-7v3', 'M3 15h18', 'M6 11.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0Z'],
  bolsa: ['M5 8h14l-1 12H6L5 8Z', 'M9 8V6.5a3 3 0 0 1 6 0V8'],
  ruta: ['M12 3v18', 'M12 5h6l2 2-2 2h-6', 'M12 12H6l-2 2 2 2h6'],
  siguiente: ['M10 7l5 5-5 5'],

  // Contactos de interes
  sirena: ['M7 18v-5a5 5 0 0 1 10 0v5', 'M5 18h14', 'M12 3v2', 'M4.5 6.5l1.4 1.4', 'M19.5 6.5l-1.4 1.4', 'M9 21h6'],
  escudo: ['M12 3 5 6v5.5c0 4.3 3 7.5 7 9.5 4-2 7-5.2 7-9.5V6l-7-3Z'],
  escudo_estrella: ['M12 3 5 6v5.5c0 4.3 3 7.5 7 9.5 4-2 7-5.2 7-9.5V6l-7-3Z', 'M12 9l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2L8.8 11.3 11 11l1-2Z'],
  salvavidas: ['M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0Z', 'M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0Z', 'M5.6 5.6l3.3 3.3', 'M15.1 15.1l3.3 3.3', 'M18.4 5.6l-3.3 3.3', 'M8.9 15.1l-3.3 3.3'],
  llama: ['M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4.2.2 1.4.9 2.2 1.8 2.5C10.5 8 11 5.5 12 3Z'],
  animal: ['M6.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z', 'M10 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z', 'M14 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z', 'M17.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z', 'M12 11c-2.5 0-5 3.5-5 6a2.5 2.5 0 0 0 3 2.4c.7-.2 1.3-.4 2-.4s1.3.2 2 .4a2.5 2.5 0 0 0 3-2.4c0-2.5-2.5-6-5-6Z'],
  compartir: ['M4 13v6h16v-6', 'M12 3v12', 'M8 7l4-4 4 4'],
  encuesta: ['M5 20v-8', 'M12 20V5', 'M19 20v-5', 'M3 20h18'],
  util: ['M4 8h16v11H4Z', 'M9 8V5h6v3', 'M4 13h16', 'M11 12v2h2v-2'],
  tablon: ['M4 4h16v12H4Z', 'M8 20l4-4 4 4', 'M8 8h8', 'M8 12h5'],
  verificado: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M8 12.5l2.7 2.7L16 9.5'],
  aviso: ['M5 21V4', 'M5 4h12l-2.5 4 2.5 4H5'],
  farmacia: ['M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z'],
  salud: ['M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z', 'M12 8v8', 'M8 12h8'],
  edificio: ['M4 20.5v-12l8-4.5 8 4.5v12', 'M3 20.5h18', 'M9.5 20.5v-5h5v5', 'M12 9v2.5'],
  documento: ['M6 3.5h8l4 4v13H6Z', 'M14 3.5v4h4', 'M9 12h6', 'M9 16h6'],
  birrete: ['M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9Z', 'M6.5 11v4.5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3V11', 'M21.5 9v5'],
  trofeo: ['M8 4h8v5a4 4 0 0 1-8 0V4Z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8.5 20h7', 'M10 17h4'],
  autobus: ['M5 4h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z', 'M4 11h16', 'M7 17v2.5', 'M17 17v2.5', 'M7.5 14h.01', 'M16.5 14h.01'],
  grupo: ['M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6', 'M16 4.6a3.5 3.5 0 0 1 0 6.8', 'M18 14.3c2 .8 3.5 2.6 3.5 5.7'],
  capilla: ['M12 2.5v4', 'M10.5 4h3', 'M12 6.5l-6 4V20.5h12V10.5l-6-4Z', 'M10 20.5v-4.5a2 2 0 0 1 4 0v4.5'],
  correo: ['M4 6h16v12H4Z', 'M4 7l8 6 8-6'],

  // El Tiempo
  gota: ['M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.7 12 3.5 12 3.5Z'],
  viento: ['M3 9h10a2.5 2.5 0 1 0-2.5-2.5', 'M3 13h14a2.5 2.5 0 1 1-2.5 2.5', 'M3 17h7'],
};

function Icono({ nombre, tam = 20, className, ...resto }) {
  const trazos = TRAZOS[nombre];
  if (!trazos) return null;

  return (
    <svg
      className={className}
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...resto}
    >
      {trazos.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export default Icono;
