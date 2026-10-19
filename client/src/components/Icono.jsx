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
