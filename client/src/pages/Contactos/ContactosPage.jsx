import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import Icono from '../../components/Icono.jsx';

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

function ContactosPage() {
  const [contactos, setContactos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    api
      .get('/contactos-interes')
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
  }, []);

  if (cargando) return <p>Cargando contactos...</p>;
  if (error) return <p className="mensaje-error">{error}</p>;

  // Solo se enlazan los grupos que existen: un acceso a un grupo vacío no
  // llevaría a ninguna parte.
  const categoriasConContactos = CATEGORIAS.filter((cat) => contactos.some((c) => c.categoria === cat.valor));

  return (
    <section>
      <h1>Contactos de interés</h1>

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
              <article key={contacto._id} className="tarjeta">
                <strong>{contacto.nombre}</strong>

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
              </article>
            ))}
          </div>
        );
      })}
    </section>
  );
}

export default ContactosPage;
