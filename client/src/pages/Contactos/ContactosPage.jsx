import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import Icono from '../../components/Icono.jsx';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import ContactoFormulario from './ContactoFormulario.jsx';
import { useTitulo } from '../../hooks/useTitulo.js';

// Mismo enum que server/src/models/ContactoInteres.js
// (CATEGORIAS_CONTACTO). El orden de esta lista es el orden en que se
// pintan los grupos en la ficha.
const CATEGORIAS = [
  { valor: 'emergencias', etiqueta: 'Emergencias', icono: 'sirena' },
  { valor: 'policia_local', etiqueta: 'Policía Local', icono: 'escudo' },
  { valor: 'guardia_civil', etiqueta: 'Guardia Civil', icono: 'escudo_estrella' },
  { valor: 'proteccion_civil', etiqueta: 'Protección Civil', icono: 'salvavidas' },
  { valor: 'bomberos', etiqueta: 'Bomberos', icono: 'llama' },
  { valor: 'centro_salud', etiqueta: 'Salud y farmacias', icono: 'salud' },
  { valor: 'ayuntamiento', etiqueta: 'Ayuntamiento', icono: 'edificio' },
  { valor: 'administracion', etiqueta: 'Otras administraciones', icono: 'documento' },
  { valor: 'educacion', etiqueta: 'Educación', icono: 'birrete' },
  { valor: 'cultura_deporte', etiqueta: 'Cultura y deporte', icono: 'trofeo' },
  { valor: 'transporte', etiqueta: 'Transporte y aparcamiento', icono: 'autobus' },
  { valor: 'asociaciones', etiqueta: 'Asociaciones y consumo', icono: 'grupo' },
  { valor: 'religioso', etiqueta: 'Centros religiosos', icono: 'capilla' },
  { valor: 'alojamiento', etiqueta: 'Alojamientos', icono: 'cama' },
  { valor: 'otro', etiqueta: 'Otros', icono: 'telefono' },
];

// Para marcar desde el movil hay que quitarle al numero todo lo que no sea
// digito o '+' (los espacios de "959 12 34 56" rompen el enlace tel:).
const enlaceTelefono = (telefono) => `tel:${telefono.replace(/[^\d+]/g, '')}`;

const idCategoria = (valor) => `contactos-${valor}`;

// scrollIntoView en vez de un enlace #ancla: con React Router el hash no
// siempre desplaza la pagina, y asi tampoco ensucia la URL ni el historial.
const irACategoria = (valor) => {
  const destino = document.getElementById(idCategoria(valor));
  if (!destino) return;
  const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  destino.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' });
};

// Botones de administrador de una ficha: editar, ocultar/mostrar y
// eliminar (con el "¿Seguro?" dentro de la propia tarjeta, no con un
// confirm() del navegador). Misma mecánica que RecursoTarjeta en Turismo.
function AccionesAdmin({ contacto, onEditar, onCambiado, onEliminado }) {
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  const alternarActivo = async () => {
    setError(null);
    setOcupado(true);
    try {
      const { data } = await api.patch(`/contactos-interes/${contacto._id}`, { activo: !contacto.activo });
      onCambiado(data.contacto);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo cambiar la visibilidad');
    } finally {
      setOcupado(false);
    }
  };

  const eliminar = async () => {
    setError(null);
    setOcupado(true);
    try {
      await api.delete(`/contactos-interes/${contacto._id}`);
      onEliminado(contacto._id);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo eliminar');
      setOcupado(false);
    }
  };

  return (
    <>
      <div className="recurso-admin">
        {confirmando ? (
          <>
            <span className="tarjeta-meta">¿Eliminar para siempre?</span>
            <button type="button" className="btn btn-peligro btn-sm" disabled={ocupado} onClick={eliminar}>
              Sí, eliminar
            </button>
            <button type="button" className="btn btn-contorno btn-sm" onClick={() => setConfirmando(false)}>
              No
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-contorno btn-sm" onClick={() => onEditar(contacto)}>
              <Icono nombre="lapiz" tam={14} /> Editar
            </button>
            <button type="button" className="btn btn-contorno btn-sm" disabled={ocupado} onClick={alternarActivo}>
              {contacto.activo ? 'Ocultar' : 'Mostrar'}
            </button>
            <button type="button" className="btn btn-plano btn-sm" onClick={() => setConfirmando(true)}>
              Eliminar
            </button>
          </>
        )}
      </div>
      {error && <p className="mensaje-error">{error}</p>}
    </>
  );
}

function ContactosPage() {
  useTitulo('Teléfonos de interés');
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';

  const [contactos, setContactos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  // null = cerrado, 'nuevo' = creando, o el contacto que se está editando.
  const [formulario, setFormulario] = useState(null);

  useEffect(() => {
    let cancelado = false;

    // El admin pide también los ocultos: es la única forma de reactivarlos.
    api
      .get(esAdmin ? '/contactos-interes/todos' : '/contactos-interes')
      .then(({ data }) => {
        if (!cancelado) setContactos(data.contactos);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudieron cargar los contactos.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [esAdmin]);

  const manejarGuardado = (guardado) => {
    setContactos((actuales) => {
      const existe = actuales.some((c) => c._id === guardado._id);
      return existe ? actuales.map((c) => (c._id === guardado._id ? guardado : c)) : [...actuales, guardado];
    });
    setFormulario(null);
  };

  if (cargando) return <p>Cargando contactos...</p>;
  if (error) return <p className="mensaje-error">{error}</p>;

  // Solo se enlazan los grupos que existen: un acceso a un grupo vacío no
  // llevaría a ninguna parte.
  const categoriasConContactos = CATEGORIAS.filter((cat) => contactos.some((c) => c.categoria === cat.valor));

  return (
    <section>
      <div className="cabecera-pagina">
        <div className="cabecera-pagina-texto">
          <h1>Contactos de interés</h1>
        </div>
        {esAdmin && (
          <div className="cabecera-pagina-acciones">
            <button
              type="button"
              className={formulario === 'nuevo' ? 'btn btn-contorno' : 'btn btn-primario'}
              onClick={() => setFormulario(formulario === 'nuevo' ? null : 'nuevo')}
            >
              <Icono nombre={formulario === 'nuevo' ? 'cerrar' : 'anadir'} tam={18} />
              {formulario === 'nuevo' ? 'Cancelar' : 'Nuevo contacto'}
            </button>
          </div>
        )}
      </div>

      <p className="tarjeta-meta">
        <Icono nombre="farmacia" tam={14} /> ¿Buscas una farmacia abierta? Mira las{' '}
        <Link to="/farmacias">farmacias de guardia</Link>.
      </p>

      {formulario && (
        <ContactoFormulario
          key={formulario === 'nuevo' ? 'nuevo' : formulario._id}
          categorias={CATEGORIAS}
          contacto={formulario === 'nuevo' ? null : formulario}
          onGuardado={manejarGuardado}
          onCancelar={() => setFormulario(null)}
        />
      )}

      {contactos.length === 0 && (
        <p>
          Todavía no hay contactos publicados. Un administrador puede añadirlos (o ejecutar{' '}
          <code>node scripts/sembrar-contactos.mjs</code> en el servidor).
        </p>
      )}

      {categoriasConContactos.length > 1 && (
        <nav className="accesos-rapidos" aria-label="Ir a una sección">
          {categoriasConContactos.map((categoria) => (
            <button
              key={categoria.valor}
              type="button"
              className="acceso-rapido"
              onClick={() => irACategoria(categoria.valor)}
            >
              <Icono nombre={categoria.icono} tam={16} /> {categoria.etiqueta}
            </button>
          ))}
        </nav>
      )}

      {CATEGORIAS.map((categoria) => {
        const deEstaCategoria = contactos.filter((c) => c.categoria === categoria.valor);
        if (deEstaCategoria.length === 0) return null;

        return (
          <div key={categoria.valor} id={idCategoria(categoria.valor)} className="grupo-contactos">
            <h2 className="contactos-titulo">
              <span className="contactos-titulo-icono" aria-hidden="true">
                <Icono nombre={categoria.icono} tam={18} />
              </span>
              {categoria.etiqueta}
            </h2>

            {deEstaCategoria.map((contacto) => (
              <article key={contacto._id} className={`tarjeta${contacto.activo ? '' : ' recurso-oculto'}`}>
                <strong>{contacto.nombre}</strong>
                {!contacto.activo && <span className="insignia insignia-aviso">Oculto</span>}

                <div className="telefonos-contacto">
                  <a className="telefono-principal" href={enlaceTelefono(contacto.telefono)}>
                    <Icono nombre="telefono" tam={16} /> {contacto.telefono}
                  </a>
                  {contacto.telefono_alternativo && (
                    <a href={enlaceTelefono(contacto.telefono_alternativo)}>
                      <Icono nombre="telefono" tam={16} /> {contacto.telefono_alternativo}
                    </a>
                  )}
                  {contacto.whatsapp_url && (
                    <a href={contacto.whatsapp_url} target="_blank" rel="noreferrer">
                      <Icono nombre="comentario" tam={16} /> WhatsApp
                    </a>
                  )}
                </div>

                {contacto.email && (
                  <div className="tarjeta-meta">
                    <Icono nombre="correo" tam={14} /> <a href={`mailto:${contacto.email}`}>{contacto.email}</a>
                  </div>
                )}
                {contacto.direccion && <div className="tarjeta-meta">
                    <Icono nombre="ubicacion" tam={14} /> {contacto.direccion}
                  </div>}
                {contacto.notas && <div className="tarjeta-meta">{contacto.notas}</div>}
                {contacto.horario && <div className="tarjeta-meta">
                    <Icono nombre="reloj" tam={14} /> {contacto.horario}
                  </div>}

                {esAdmin && (
                  <AccionesAdmin
                    contacto={contacto}
                    onEditar={setFormulario}
                    onCambiado={manejarGuardado}
                    onEliminado={(id) => setContactos((actuales) => actuales.filter((c) => c._id !== id))}
                  />
                )}
              </article>
            ))}
          </div>
        );
      })}
    </section>
  );
}

export default ContactosPage;
