import Icono from './Icono.jsx';

// Marca de cuenta oficial (el Ayuntamiento) junto al nombre. Solo la pone un
// admin en el servidor; aquí únicamente se pinta.
function InsigniaOficial({ conTexto = false }) {
  return (
    <span className="insignia-oficial" title="Cuenta oficial verificada">
      <Icono nombre="verificado" tam={15} />
      {conTexto && <span>Cuenta oficial</span>}
    </span>
  );
}

export default InsigniaOficial;
