import { esVerificado } from '../utils/verificado.js';

// La insignia azul de perfil verificado junto al nombre, como en otras redes:
// un círculo relleno con el check. Va relleno a propósito (los iconos de la
// app son de trazo) para que no se confunda con la de cuenta oficial del
// Ayuntamiento. Si el usuario no está verificado, no pinta nada.
function InsigniaVerificado({ usuario, conTexto = false }) {
  if (!esVerificado(usuario)) return null;
  return (
    <span className="insignia-verificado" title="Perfil verificado">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 1.8l2.3 1.7 2.8-.3 1.1 2.6 2.6 1.1-.3 2.8 1.7 2.3-1.7 2.3.3 2.8-2.6 1.1-1.1 2.6-2.8-.3L12 22.2l-2.3-1.7-2.8.3-1.1-2.6-2.6-1.1.3-2.8L1.8 12l1.7-2.3-.3-2.8 2.6-1.1 1.1-2.6 2.8.3z"
        />
        <path d="M8 12.3l2.6 2.6L16.2 9.3" fill="none" stroke="var(--superficie)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {conTexto ? <span>Verificado</span> : <span className="solo-lectores">Perfil verificado</span>}
    </span>
  );
}

export default InsigniaVerificado;
