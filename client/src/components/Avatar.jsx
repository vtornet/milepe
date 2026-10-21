// Ocho fondos, todos con suficiente contraste para texto blanco encima. Se
// elige por el nombre y no al azar para que el mismo vecino tenga siempre
// el mismo color: parte de reconocer a alguien en un feed es reconocer su
// mancha de color antes de leer su nombre.
//
// Van en una gama amplia a proposito, no en los azules del logo: si todos
// los avatares fueran del color de la marca no se distinguirian entre si,
// que es justo para lo que estan.
const FONDOS = ['#0f6aa6', '#7a4b8c', '#a33b4d', '#8c5a2b', '#3f7a3f', '#9c6b1f', '#2a6f72', '#4a5a9c'];

// Suma de códigos de carácter: no necesita ser un hash bueno, solo
// estable y repartido.
const colorPara = (texto) => {
  let suma = 0;
  for (let i = 0; i < texto.length; i += 1) suma += texto.charCodeAt(i);
  return FONDOS[suma % FONDOS.length];
};

// Iniciales a partir del nombre: "Juan Pérez" -> "JP", "lepero82" -> "L".
const inicialesDe = (texto) => {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '?';
  if (palabras.length === 1) return palabras[0].slice(0, 1).toUpperCase();
  return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase();
};

const CLASE_TAMANO = { xs: 'avatar-xs', sm: 'avatar-sm', md: '', lg: 'avatar-lg' };

// Avatar de un vecino: su foto si tiene, y si no sus iniciales sobre un
// color derivado del nombre. El hueco gris con una silueta genérica -que es
// lo que sale por defecto cuando nadie ha subido foto, o sea casi siempre
// al principio- hace que un feed parezca vacío aunque esté lleno.
function Avatar({ usuario, tamano = 'md', className = '' }) {
  // nombre_usuario PRIMERO y no el nombre real: las iniciales se pintan en
  // publicaciones y comentarios, asi que sacarlas del nombre real seria
  // filtrar por la puerta de atras lo que la API se cuida de no enviar.
  const nombre = usuario?.nombre_usuario || usuario?.nombre || '';
  const clases = ['avatar', CLASE_TAMANO[tamano], className].filter(Boolean).join(' ');

  if (usuario?.avatar_url) {
    return (
      <span className={clases}>
        {/* alt vacío y no el nombre: el nombre ya está escrito al lado, y
            repetirlo hace que un lector de pantalla lo lea dos veces. */}
        <img src={usuario.avatar_url} alt="" loading="lazy" />
      </span>
    );
  }

  return (
    <span className={clases} style={{ background: colorPara(nombre || '?') }} aria-hidden="true">
      {inicialesDe(nombre)}
    </span>
  );
}

export default Avatar;
