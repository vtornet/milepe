import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import BotonReportar from '../../components/BotonReportar.jsx';
import Icono from '../../components/Icono.jsx';
import useSondeo from '../../hooks/useSondeo.js';
import { EsqueletoLista } from '../../components/Esqueleto.jsx';

const MENSAJES_POR_PAGINA = 50; // igual que MENSAJES_POR_PAGINA en el controlador
const MS_ENTRE_SONDEOS = 10000;

const formatearHora = (iso) => new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });

// Une lo que ya teniamos con lo que acaba de llegar, sin duplicados y en
// orden. Hace falta porque el sondeo pide siempre la ultima pagina: si se
// sustituyese el array sin mas, los mensajes antiguos que el usuario haya
// cargado al subir desaparecerian cada diez segundos.
const combinarMensajes = (previos, nuevos) => {
  const porId = new Map(previos.map((mensaje) => [String(mensaje._id), mensaje]));
  for (const mensaje of nuevos) {
    porId.set(String(mensaje._id), mensaje);
  }

  return [...porId.values()].sort((a, b) => new Date(a.fecha_creacion) - new Date(b.fecha_creacion));
};

function ConversacionPage() {
  const { id } = useParams();
  const { usuario } = useAuth();

  const [con, setCon] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const [hayMasAntiguos, setHayMasAntiguos] = useState(false);
  const [cargandoAntiguos, setCargandoAntiguos] = useState(false);

  // Un hilo pasa a solo lectura cuando se rompe el seguimiento mutuo (o
  // cuando hay un bloqueo). Lo dice el servidor en cada carga, no se
  // deduce aquí: así el aviso desaparece solo en el siguiente sondeo si la
  // otra persona vuelve a seguirte.
  const [soloLectura, setSoloLectura] = useState(false);
  const [razonSoloLectura, setRazonSoloLectura] = useState(null);

  const finDelHilo = useRef(null);

  const cargarUltimos = useCallback(
    async ({ primeraVez } = {}) => {
      const { data } = await api.get(`/conversaciones/${id}/mensajes`);
      setCon(data.con);
      setMensajes((previos) => combinarMensajes(previos, data.mensajes));
      setSoloLectura(Boolean(data.solo_lectura));
      setRazonSoloLectura(data.razon_solo_lectura || null);

      // Si la primera pagina viene llena, es que hay mas hacia atras. No
      // es exacto (si el hilo tiene justo 50 se ofrecera un boton que no
      // trae nada), pero no requiere una consulta de conteo extra.
      if (primeraVez) {
        setHayMasAntiguos(data.mensajes.length === MENSAJES_POR_PAGINA);
      }

      // Dar el hilo por leido es una peticion aparte a proposito (ver el
      // controlador): abrirlo es justo el momento de hacerla.
      await api.patch(`/conversaciones/${id}/leida`);
    },
    [id],
  );

  useEffect(() => {
    let cancelado = false;

    // Al cambiar de hilo hay que vaciar lo anterior: si no, se veria un
    // instante la conversacion de otra persona.
    setMensajes([]);
    setCon(null);
    setCargando(true);
    setError(null);

    cargarUltimos({ primeraVez: true })
      .catch((err) => {
        if (!cancelado) {
          setError(
            err.response?.status === 404
              ? 'Esta conversación no existe o no es tuya.'
              : 'No se pudieron cargar los mensajes.',
          );
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [cargarUltimos]);

  // Todavía no hay tiempo real: se vuelve a preguntar cada diez segundos
  // mientras el hilo esté abierto. Ahora con useSondeo, que además deja de
  // preguntar cuando la pestaña no se ve -sondear un chat que nadie está
  // mirando es gastar la batería del móvil de un vecino- y es el sitio
  // único que habrá que cambiar cuando se enchufe socket.io; el servidor
  // ya tiene su mitad de esa frontera en utils/tiempoReal.js.
  //
  // Sigue sondeando aunque el hilo esté en solo lectura, porque la
  // respuesta trae también ese estado: así, si la otra persona vuelve a
  // seguirte, el aviso se va solo y se puede escribir sin recargar.
  useSondeo(cargarUltimos, MS_ENTRE_SONDEOS);

  // Bajar al ultimo mensaje, que es lo que se quiere ver al abrir un chat
  // y tras enviar.
  useEffect(() => {
    finDelHilo.current?.scrollIntoView({ block: 'end' });
  }, [mensajes.length]);

  const cargarAntiguos = async () => {
    if (mensajes.length === 0) return;

    setCargandoAntiguos(true);
    try {
      const { data } = await api.get(`/conversaciones/${id}/mensajes`, {
        params: { antes: mensajes[0].fecha_creacion },
      });
      setMensajes((previos) => combinarMensajes(data.mensajes, previos));
      setHayMasAntiguos(data.mensajes.length === MENSAJES_POR_PAGINA);
    } catch {
      setError('No se pudieron cargar los mensajes anteriores.');
    } finally {
      setCargandoAntiguos(false);
    }
  };

  const enviar = async (evento) => {
    evento.preventDefault();

    const limpio = texto.trim();
    if (!limpio || enviando) return;

    setEnviando(true);
    setError(null);

    try {
      const { data } = await api.post(`/conversaciones/${id}/mensajes`, { texto: limpio });
      setMensajes((previos) => combinarMensajes(previos, [data.mensaje]));
      setTexto('');
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo enviar el mensaje.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section>
      <p className="tarjeta-meta">
        <Link to="/mensajes">← Mensajes</Link>
      </p>

      <h1>
        {con?._id ? (
          <Link to={`/vecino/${con._id}`}>{con.nombre_usuario}</Link>
        ) : (
          con?.nombre_usuario || 'Conversación'
        )}
      </h1>

      {cargando && <EsqueletoLista cuantas={5} />}

      {!cargando && !error && (
        <>
          {hayMasAntiguos && (
            <button type="button" disabled={cargandoAntiguos} onClick={cargarAntiguos} style={{ marginBottom: 10 }}>
              {cargandoAntiguos ? 'Cargando...' : 'Ver mensajes anteriores'}
            </button>
          )}

          <div className="hilo-mensajes">
            {mensajes.length === 0 && <p className="tarjeta-meta">Aún no os habéis escrito nada. Empieza tú.</p>}

            {mensajes.map((mensaje) => {
              const esMio = String(mensaje.autor_id?._id || mensaje.autor_id) === String(usuario?._id);

              return (
                <div key={mensaje._id} className={esMio ? 'mensaje mensaje-mio' : 'mensaje'}>
                  {/* Un mensaje retirado por moderación conserva su sitio
                      -se ve que ahí había algo- pero su texto ya no viaja
                      desde el servidor. */}
                  {mensaje.retirado ? (
                    <div className="mensaje-texto comentario-retirado">Mensaje retirado por moderación</div>
                  ) : (
                    <div className="mensaje-texto">{mensaje.texto}</div>
                  )}

                  <div className="mensaje-hora">
                    {formatearHora(mensaje.fecha_creacion)}
                    {esMio && mensaje.leido_en && ' · leído'}
                    {/* Reportar un privado solo tiene sentido en los que
                        recibes: los tuyos ya los escribiste tú. Solo lo
                        puede hacer quien está en el hilo, y eso lo
                        comprueba el servidor. */}
                    {!esMio && !mensaje.retirado && (
                      <BotonReportar contenidoTipo="mensaje" contenidoId={mensaje._id} compacto />
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={finDelHilo} />
          </div>

          {soloLectura ? (
            // Se explica, no se esconde: una caja de texto que desaparece
            // sin motivo se lee como una avería. Y la conversación se
            // queda entera, que es justo lo que hay que dejar claro.
            <div className="aviso aviso-info">
              <Icono nombre="alerta" tam={18} />
              <span>
                {razonSoloLectura === 'bloqueo'
                  ? 'No podéis escribiros porque hay un bloqueo entre vosotros. La conversación se queda guardada.'
                  : 'Esta conversación está en solo lectura: para volver a escribiros tenéis que seguiros mutuamente. Lo que os dijisteis sigue aquí.'}
              </span>
            </div>
          ) : (
            <form onSubmit={enviar} className="formulario-mensaje">
              <textarea
                rows={2}
                maxLength={2000}
                placeholder="Escribe un mensaje..."
                value={texto}
                onChange={(evento) => setTexto(evento.target.value)}
              />
              <button type="submit" disabled={enviando || texto.trim().length === 0}>
                {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </form>
          )}
        </>
      )}

      {error && <p className="mensaje-error">{error}</p>}
    </section>
  );
}

export default ConversacionPage;
