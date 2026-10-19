// Esqueletos de carga. Sustituyen a los "Cargando..." sueltos: ocupan el
// hueco que va a ocupar el contenido, asi que la pagina no da un salto
// cuando llega, y la espera se percibe mas corta aunque dure lo mismo.

export function Linea({ ancho = '100%', alto = 11 }) {
  return <div className="esqueleto esqueleto-linea" style={{ width: ancho, height: alto }} />;
}

// Imita la forma de TarjetaPublicacion (avatar + dos lineas de cabecera +
// parrafo) para que el relevo entre esqueleto y contenido real no mueva
// nada de sitio.
export function EsqueletoPublicacion() {
  return (
    <div className="pub" aria-hidden="true">
      <div className="pub-cabecera">
        <div className="esqueleto esqueleto-circulo" style={{ width: 40, height: 40 }} />
        <div style={{ flex: 1 }}>
          <Linea ancho="38%" />
          <Linea ancho="24%" alto={9} />
        </div>
      </div>
      <div className="pub-cuerpo">
        <Linea ancho="65%" alto={15} />
        <div style={{ height: 6 }} />
        <Linea />
        <Linea ancho="92%" />
        <Linea ancho="54%" />
      </div>
    </div>
  );
}

// Varias de golpe: un feed que carga una sola tarjeta fantasma parece roto.
export function EsqueletoFeed({ cuantas = 3 }) {
  return (
    <div role="status" aria-label="Cargando contenido">
      {Array.from({ length: cuantas }, (_, i) => (
        <EsqueletoPublicacion key={i} />
      ))}
    </div>
  );
}

export function EsqueletoLista({ cuantas = 4 }) {
  return (
    <div role="status" aria-label="Cargando">
      {Array.from({ length: cuantas }, (_, i) => (
        <div key={i} className="tarjeta" aria-hidden="true">
          <div className="fila" style={{ gap: 12 }}>
            <div className="esqueleto esqueleto-circulo" style={{ width: 40, height: 40 }} />
            <div style={{ flex: 1 }}>
              <Linea ancho="45%" />
              <Linea ancho="70%" alto={9} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
