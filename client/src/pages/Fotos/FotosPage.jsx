import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import CabeceraSeccion from '../../components/CabeceraSeccion.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import Icono from '../../components/Icono.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import FotoFormulario from './FotoFormulario.jsx';
import FotoTarjeta from './FotoTarjeta.jsx';

function FotosPage() {
  const [fotos, setFotos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [epoca, setEpoca] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);

    const params = {};
    if (epoca) params.epoca = epoca;

    api
      .get('/fotos', { params })
      .then(({ data }) => {
        if (!cancelado) setFotos(data.fotos);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudieron cargar las fotos.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [epoca]);

  const manejarFotoCreada = (fotoNueva) => {
    setFotos([fotoNueva, ...fotos]);
    setMostrarFormulario(false);
  };

  return (
    <section>
      <CabeceraSeccion
        ruta="/fotos"
        descripcion="Lepe de antes y de ahora, en imágenes"
        textoNuevo="Subir foto"
        formularioAbierto={mostrarFormulario}
        onAlternarFormulario={() => setMostrarFormulario(!mostrarFormulario)}
      />

      {mostrarFormulario && <FotoFormulario onCreada={manejarFotoCreada} />}

      <div className="lista-filtros">
        <select value={epoca} onChange={(e) => setEpoca(e.target.value)}>
          <option value="">Todas las épocas</option>
          <option value="actual">Actuales</option>
          <option value="antigua">Antiguas</option>
        </select>
      </div>

      {cargando && <EsqueletoFeed />}
      {error && (
        <div className="aviso aviso-error">
          <Icono nombre="alerta" tam={18} />
          <span>{error}</span>
        </div>
      )}
      {!cargando && !error && fotos.length === 0 && (
        <EstadoVacio icono="fotos" titulo="Todavía no hay fotos">
          Sube una foto antigua del pueblo, o una de hoy mismo.
        </EstadoVacio>
      )}

      {fotos.map((foto) => (
        <FotoTarjeta key={foto._id} foto={foto} />
      ))}
    </section>
  );
}

export default FotosPage;
