import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import CabeceraSeccion from '../../components/CabeceraSeccion.jsx';
import EstadoVacio from '../../components/EstadoVacio.jsx';
import Icono from '../../components/Icono.jsx';
import SelectorFotos from '../../components/SelectorFotos.jsx';
import TarjetaPublicacion, { Dato } from '../../components/TarjetaPublicacion.jsx';
import { EsqueletoFeed } from '../../components/Esqueleto.jsx';
import SelectorUbicacion from '../Quejas/SelectorUbicacion.jsx';
import { subirImagenes } from '../../utils/subidas.js';
import { fechaCorta } from '../../utils/fechas.js';

// Mismos enums que server/src/models/AnimalDetalle.js.
const CATEGORIAS = {
  perdido: { etiqueta: 'Perdido', clase: 'insignia-peligro' },
  encontrado: { etiqueta: 'Encontrado', clase: 'insignia-aviso' },
  adopcion: { etiqueta: 'En adopción', clase: 'insignia-info' },
  acogida: { etiqueta: 'Busca acogida', clase: 'insignia-info' },
};
const ESPECIES = { perro: 'Perro', gato: 'Gato', ave: 'Ave', otro: 'Otro animal' };
const SEXOS = { desconocido: 'No se sabe', macho: 'Macho', hembra: 'Hembra' };
const ZONAS = { lepe: 'Lepe', la_antilla: 'La Antilla', islantilla: 'Islantilla', otra: 'Otra zona' };

const CON_FECHA = ['perdido', 'encontrado'];
const INICIAL = {
  titulo: '',
  contenido: '',
  categoria: 'perdido',
  especie: 'perro',
  nombre: '',
  sexo: 'desconocido',
  zona: 'lepe',
  fecha_suceso: '',
  telefono_contacto: '',
};

const enlaceTelefono = (telefono) => `tel:${telefono.replace(/[^\d+]/g, '')}`;
const enlaceMapa = ({ lat, lng }) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

function AnimalFormulario({ onCreado }) {
  const [datos, setDatos] = useState(INICIAL);
  const [archivos, setArchivos] = useState([]);
  const [ubicacion, setUbicacion] = useState(null);
  const [conMapa, setConMapa] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (e) => setDatos({ ...datos, [e.target.name]: e.target.value });
  const conFecha = CON_FECHA.includes(datos.categoria);

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    // El servidor lo exige igual; avisar aquí ahorra subir nada.
    if (archivos.length === 0) {
      setError('Añade al menos una foto del animal: sin ella nadie podrá reconocerlo.');
      return;
    }
    setEnviando(true);
    try {
      const imagenes = await subirImagenes(archivos);
      const { data } = await api.post('/animales', {
        ...datos,
        imagenes,
        fecha_suceso: conFecha && datos.fecha_suceso ? new Date(datos.fecha_suceso).toISOString() : null,
        ubicacion: conMapa && ubicacion ? ubicacion : null,
      });
      onCreado(data.animal);
      setDatos(INICIAL);
      setArchivos([]);
      setUbicacion(null);
      setConMapa(false);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo publicar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="tarjeta" onSubmit={enviar}>
      <h2>Publicar un animal</h2>

      <div className="aviso aviso-info">
        <Icono nombre="alerta" tam={18} />
        <span>
          <strong>Aquí no se venden animales.</strong> Si buscas hogar para uno, publícalo en adopción; si quieres
          uno, adopta. Las publicaciones de venta se retiran.
        </span>
      </div>


      <label htmlFor="animal-categoria">Qué pasa</label>
      <select id="animal-categoria" name="categoria" value={datos.categoria} onChange={cambiar}>
        {Object.entries(CATEGORIAS).map(([valor, { etiqueta }]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </select>

      <div className="fila-fechas">
        <div>
          <label htmlFor="animal-especie">Animal</label>
          <select id="animal-especie" name="especie" value={datos.especie} onChange={cambiar}>
            {Object.entries(ESPECIES).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="animal-sexo">Sexo</label>
          <select id="animal-sexo" name="sexo" value={datos.sexo} onChange={cambiar}>
            {Object.entries(SEXOS).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label htmlFor="animal-titulo">Título</label>
      <input id="animal-titulo" name="titulo" required maxLength={120} value={datos.titulo} onChange={cambiar} />

      <label htmlFor="animal-nombre">Nombre del animal (si lo tiene)</label>
      <input id="animal-nombre" name="nombre" maxLength={60} value={datos.nombre} onChange={cambiar} />

      <label htmlFor="animal-contenido">Descripción (color, tamaño, collar, carácter...)</label>
      <textarea id="animal-contenido" name="contenido" rows={3} required maxLength={5000} value={datos.contenido} onChange={cambiar} />

      {conFecha && (
        <>
          <label htmlFor="animal-fecha">{datos.categoria === 'perdido' ? 'Cuándo se perdió' : 'Cuándo lo encontraste'}</label>
          <input id="animal-fecha" name="fecha_suceso" type="datetime-local" required value={datos.fecha_suceso} onChange={cambiar} />
        </>
      )}

      <label htmlFor="animal-zona">Zona</label>
      <select id="animal-zona" name="zona" value={datos.zona} onChange={cambiar}>
        {Object.entries(ZONAS).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </select>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
        <input type="checkbox" checked={conMapa} onChange={(e) => setConMapa(e.target.checked)} style={{ width: 'auto' }} />
        Marcar en el mapa dónde se perdió o se vio
      </label>
      {conMapa && <SelectorUbicacion value={ubicacion} onChange={setUbicacion} />}

      <label htmlFor="animal-telefono">Teléfono de contacto (opcional, se mostrará a todo el mundo)</label>
      <input id="animal-telefono" name="telefono_contacto" type="tel" maxLength={30} value={datos.telefono_contacto} onChange={cambiar} />

      <SelectorFotos archivos={archivos} onChange={setArchivos} etiqueta="Fotos (al menos una)" />

      {error && <p className="mensaje-error">{error}</p>}
      <button type="submit" disabled={enviando}>
        {enviando ? 'Publicando...' : 'Publicar'}
      </button>
    </form>
  );
}

function AnimalTarjeta({ animal: inicial }) {
  const { usuario } = useAuth();
  const [animal, setAnimal] = useState(inicial);
  const [error, setError] = useState(null);

  const autorId = animal.autor?._id || animal.autor_id;
  const puedeResolver = Boolean(
    usuario && (String(autorId) === String(usuario._id) || usuario.rol === 'moderador' || usuario.rol === 'admin'),
  );
  const categoria = CATEGORIAS[animal.categoria] || { etiqueta: animal.categoria, clase: '' };
  const textoResuelto = animal.categoria === 'perdido' ? 'Ya ha vuelto a casa' : animal.categoria === 'encontrado' ? 'Ya está con su familia' : 'Ya tiene hogar';

  const resolver = async () => {
    setError(null);
    try {
      const { data } = await api.patch(`/animales/${animal._id}/resolver`, { resuelto: !animal.resuelto });
      setAnimal({ ...animal, ...data });
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo cambiar');
    }
  };

  return (
    <TarjetaPublicacion
      post={animal}
      chips={
        <>
          <span className={`insignia ${categoria.clase}`}>{categoria.etiqueta}</span>
          <span className="insignia">{ESPECIES[animal.especie] || animal.especie}</span>
          {animal.resuelto && <span className="insignia insignia-exito">{textoResuelto}</span>}
        </>
      }
      datos={
        <>
          {animal.nombre && <Dato icono="corazon">Se llama {animal.nombre}</Dato>}
          {animal.sexo && animal.sexo !== 'desconocido' && <Dato icono="perfil">{SEXOS[animal.sexo]}</Dato>}
          {animal.fecha_suceso && (
            <Dato icono="reloj">
              {animal.categoria === 'perdido' ? 'Perdido el' : 'Encontrado el'} {fechaCorta(animal.fecha_suceso)}
            </Dato>
          )}
          <Dato icono="ubicacion">
            {ZONAS[animal.zona]}
            {animal.ubicacion && (
              <>
                {' · '}
                <a href={enlaceMapa(animal.ubicacion)} target="_blank" rel="noreferrer">
                  ver en el mapa
                </a>
              </>
            )}
          </Dato>
          {animal.telefono_contacto && (
            <Dato icono="telefono">
              <a href={enlaceTelefono(animal.telefono_contacto)}>{animal.telefono_contacto}</a>
            </Dato>
          )}
        </>
      }
    >
      {puedeResolver && (
        <button type="button" className="btn btn-contorno btn-sm" onClick={resolver}>
          {animal.resuelto ? 'Deshacer: no está resuelto' : `Marcar: ${textoResuelto.toLowerCase()}`}
        </button>
      )}
      {error && <p className="mensaje-error">{error}</p>}
    </TarjetaPublicacion>
  );
}

function AnimalesPage() {
  const [animales, setAnimales] = useState(null);
  const [error, setError] = useState(null);
  const [categoria, setCategoria] = useState('');
  const [especie, setEspecie] = useState('');
  const [verResueltos, setVerResueltos] = useState(false);
  const [formulario, setFormulario] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setAnimales(null);
    const params = {};
    if (categoria) params.categoria = categoria;
    if (especie) params.especie = especie;
    if (verResueltos) params.incluirResueltos = 'true';

    api
      .get('/animales', { params })
      .then(({ data }) => !cancelado && setAnimales(data.animales))
      .catch(() => !cancelado && setError('No se pudieron cargar los animales.'));
    return () => {
      cancelado = true;
    };
  }, [categoria, especie, verResueltos]);

  return (
    <section>
      <CabeceraSeccion
        ruta="/animales"
        descripcion="Mascotas perdidas y encontradas, adopciones y casas de acogida. Aquí no se venden animales: adopta."
        textoNuevo="Publicar"
        formularioAbierto={formulario}
        onAlternarFormulario={() => setFormulario(!formulario)}
      />

      {formulario && (
        <AnimalFormulario
          onCreado={(nuevo) => {
            setAnimales((actuales) => [nuevo, ...(actuales || [])]);
            setFormulario(false);
          }}
        />
      )}

      <div className="lista-filtros">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todo</option>
          {Object.entries(CATEGORIAS).map(([valor, { etiqueta }]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
        <select value={especie} onChange={(e) => setEspecie(e.target.value)}>
          <option value="">Todos los animales</option>
          {Object.entries(ESPECIES).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={verResueltos} onChange={(e) => setVerResueltos(e.target.checked)} style={{ width: 'auto' }} />
          Ver también los resueltos
        </label>
      </div>

      {error && (
        <div className="aviso aviso-error">
          <Icono nombre="alerta" tam={18} />
          <span>{error}</span>
        </div>
      )}
      {!error && animales === null && <EsqueletoFeed cuantas={2} />}
      {animales?.length === 0 && (
        <EstadoVacio icono="animal" titulo="No hay animales publicados">
          Si has perdido o encontrado un animal, o buscas hogar para uno, publícalo aquí con una foto.
        </EstadoVacio>
      )}
      {animales?.map((a) => (
        <AnimalTarjeta key={a._id} animal={a} />
      ))}
    </section>
  );
}

export default AnimalesPage;
