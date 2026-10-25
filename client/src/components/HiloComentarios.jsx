import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useReacciones } from '../context/ReaccionesContext.jsx';
import Avatar from './Avatar.jsx';
import InsigniaOficial from './InsigniaOficial.jsx';
import Icono from './Icono.jsx';
import BotonReportar from './BotonReportar.jsx';
import SelectorReaccion from './SelectorReaccion.jsx';
import ResumenReacciones from './ResumenReacciones.jsx';
import { haceCuanto, fechaCompleta } from '../utils/fechas.js';
import InsigniaVerificado from './InsigniaVerificado.jsx';

// Cuántas respuestas se piden de golpe en cada nivel.
const POR_PAGINA = 10;
// Cuántos niveles se sangran antes de ofrecer "continuar hilo". El
// servidor lo manda en cada respuesta (niveles_sangrado); esto es el valor
// de partida mientras no ha contestado todavía.
const NIVELES_POR_DEFECTO = 3;

// El hilo de comentarios de una publicación.
//
// Se carga por niveles y paginado, no entero: un post con doscientos
// comentarios enviaba doscientos para enseñar los cinco primeros, y las
// respuestas de un comentario solo le interesan a quien las pide.
//
// Pasado el tercer nivel se deja de sangrar y aparece "continuar hilo",
// que vuelve a plantar la vista en ese comentario. Sin eso, en un móvil la
// cuarta respuesta de una respuesta queda en una columna de dos palabras
// de ancho.
function HiloComentarios({ postId, permitirValoracion = false, propietarioId = null, onDelta = () => {} }) {
  const { usuario } = useAuth();
  const { mias, anotar } = useReacciones();

  // Cada nivel del hilo guardado por el id de su padre; 'raiz' es el
  // primer nivel. Así entrar y salir de un subhilo no obliga a volver a
  // pedir lo que ya estaba cargado.
  const [niveles, setNiveles] = useState({});
  const [abiertos, setAbiertos] = useState({});
  const [nivelesSangrado, setNivelesSangrado] = useState(NIVELES_POR_DEFECTO);

  // Pila de "continuar hilo": cada entrada es el comentario en el que se
  // ha plantado la vista. Es una pila y no un solo valor para que volver
  // atrás devuelva al sitio del que se vino, no al principio.
  const [pila, setPila] = useState([]);

  const [respondiendoA, setRespondiendoA] = useState(null);
  const [editando, setEditando] = useState(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(null);
  const [error, setError] = useState(null);

  const claveDe = (padreId) => padreId || 'raiz';

  const cargarNivel = useCallback(
    async (padreId, pagina = 1) => {
      const clave = claveDe(padreId);

      try {
        const { data } = await api.get(`/posts/${postId}/comentarios`, {
          params: { padre: padreId || undefined, pagina, limite: POR_PAGINA },
        });

        if (data.niveles_sangrado) setNivelesSangrado(data.niveles_sangrado);

        setNiveles((anterior) => {
          const yaHabia = pagina > 1 ? anterior[clave]?.lista || [] : [];
          return {
            ...anterior,
            [clave]: {
              // Se añade al final en vez de sustituir: la página 2 no puede
              // borrar la 1, que es lo que está mirando quien pulsó.
              lista: [...yaHabia, ...data.comentarios],
              total: data.paginacion.total,
              pagina: data.paginacion.pagina,
            },
          };
        });
      } catch (err) {
        setError(err.response?.data?.mensaje || 'No se pudieron cargar los comentarios.');
      }
    },
    [postId],
  );

  useEffect(() => {
    cargarNivel(null);
  }, [cargarNivel]);

  const alternarRespuestas = (comentarioId) => {
    const abierto = abiertos[comentarioId];
    setAbiertos((anterior) => ({ ...anterior, [comentarioId]: !abierto }));
    if (!abierto && !niveles[comentarioId]) cargarNivel(comentarioId);
  };

  const entrarEnHilo = (comentario) => {
    setPila((anterior) => [...anterior, comentario]);
    if (!niveles[comentario._id]) cargarNivel(comentario._id);
    setAbiertos((anterior) => ({ ...anterior, [comentario._id]: true }));
  };

  // Suma o resta en el num_respuestas que se tiene en memoria, en el nivel
  // donde esté ese comentario. Sin esto, el botón seguiría diciendo "ver 2
  // respuestas" después de añadir la tercera.
  const ajustarContador = (comentarioId, delta) => {
    setNiveles((anterior) => {
      const copia = { ...anterior };
      for (const clave of Object.keys(copia)) {
        copia[clave] = {
          ...copia[clave],
          lista: copia[clave].lista.map((c) =>
            String(c._id) === String(comentarioId)
              ? { ...c, num_respuestas: Math.max(0, (c.num_respuestas || 0) + delta) }
              : c,
          ),
        };
      }
      return copia;
    });
  };

  const insertarEnNivel = (padreId, comentario) => {
    const clave = claveDe(padreId);
    setNiveles((anterior) => ({
      ...anterior,
      [clave]: {
        lista: [...(anterior[clave]?.lista || []), comentario],
        total: (anterior[clave]?.total || 0) + 1,
        pagina: anterior[clave]?.pagina || 1,
      },
    }));
  };

  const reemplazar = (comentario) => {
    setNiveles((anterior) => {
      const copia = { ...anterior };
      for (const clave of Object.keys(copia)) {
        copia[clave] = {
          ...copia[clave],
          lista: copia[clave].lista.map((c) =>
            String(c._id) === String(comentario._id) ? { ...c, ...comentario } : c,
          ),
        };
      }
      return copia;
    });
  };

  const crear = async ({ texto, valoracion, padreId }) => {
    const { data } = await api.post(`/posts/${postId}/comentarios`, {
      texto,
      valoracion: valoracion > 0 ? valoracion : undefined,
      padre_id: padreId || undefined,
    });

    insertarEnNivel(padreId, data.comentario);

    // El contador de la barra de arriba cuenta todo el hilo, respuestas
    // incluidas, igual que Post.num_comentarios en el servidor.
    onDelta(1);

    if (padreId) {
      ajustarContador(padreId, 1);
      // Si se responde a algo cuyas respuestas estaban cerradas, se abren:
      // escribir y no ver aparecer lo escrito parece que se ha perdido.
      setAbiertos((anterior) => ({ ...anterior, [padreId]: true }));
    }
  };

  const editar = async (comentarioId, texto) => {
    const { data } = await api.patch(`/posts/${postId}/comentarios/${comentarioId}`, { texto });
    reemplazar(data.comentario);
    setEditando(null);
  };

  const borrar = async (comentarioId) => {
    try {
      const { data } = await api.delete(`/posts/${postId}/comentarios/${comentarioId}`);
      // El servidor devuelve el hueco: sin texto ni autor, con su marca de
      // quién lo retiró. Se sustituye entero y no se mezcla con lo que
      // había, o el texto borrado seguiría en pantalla.
      setNiveles((anterior) => {
        const copia = { ...anterior };
        for (const clave of Object.keys(copia)) {
          copia[clave] = {
            ...copia[clave],
            lista: copia[clave].lista.map((c) =>
              String(c._id) === String(comentarioId) ? data.comentario : c,
            ),
          };
        }
        return copia;
      });
      setConfirmandoBorrado(null);
      onDelta(-1);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo borrar el comentario.');
    }
  };

  const reaccionar = async (comentarioId, tipo) => {
    if (!usuario) {
      setError('Inicia sesión para participar.');
      return;
    }

    try {
      const { data } = await api.post(`/posts/${postId}/comentarios/reaccion`, {
        tipo,
        comentario_id: comentarioId,
      });
      reemplazar({ _id: comentarioId, reacciones_resumen: data.reacciones });
      anotar('comentarios', comentarioId, data.tipo);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo registrar tu reacción.');
    }
  };

  const raizActual = pila[pila.length - 1] || null;
  const nivelVisible = niveles[claveDe(raizActual?._id)];
  const palabra = permitirValoracion ? 'reseña' : 'comentario';

  const pintarRama = (comentario, nivel) => {
    const hijos = niveles[comentario._id];
    const abierto = abiertos[comentario._id];
    const ultimoNivel = nivel >= nivelesSangrado - 1;

    return (
      <div key={comentario._id} className="comentario-rama" data-nivel={Math.min(nivel, nivelesSangrado - 1)}>
        <Comentario
          propietarioId={propietarioId}
          comentario={comentario}
          usuario={usuario}
          miReaccion={mias.comentarios[comentario._id] || null}
          onReaccionar={(tipo) => reaccionar(comentario._id, tipo)}
          respondiendo={respondiendoA === comentario._id}
          onResponder={() => setRespondiendoA(respondiendoA === comentario._id ? null : comentario._id)}
          editando={editando === comentario._id}
          onEditar={() => setEditando(comentario._id)}
          onCancelarEdicion={() => setEditando(null)}
          onGuardarEdicion={(texto) => editar(comentario._id, texto)}
          confirmando={confirmandoBorrado === comentario._id}
          onPedirBorrado={() => setConfirmandoBorrado(comentario._id)}
          onCancelarBorrado={() => setConfirmandoBorrado(null)}
          onConfirmarBorrado={() => borrar(comentario._id)}
          onEnviarRespuesta={(texto) => crear({ texto, padreId: comentario._id })}
        />

        {comentario.num_respuestas > 0 &&
          (ultimoNivel ? (
            // Pasado el último nivel que se sangra, el hilo no sigue hacia
            // dentro: se abre aparte.
            <button type="button" className="hilo-enlace" onClick={() => entrarEnHilo(comentario)}>
              <Icono nombre="comentario" tam={14} /> Continuar hilo ({comentario.num_respuestas})
            </button>
          ) : (
            <button type="button" className="hilo-enlace" onClick={() => alternarRespuestas(comentario._id)}>
              <Icono nombre={abierto ? 'cerrar' : 'comentario'} tam={14} />
              {abierto
                ? ' Ocultar respuestas'
                : ` Ver ${comentario.num_respuestas} ${comentario.num_respuestas === 1 ? 'respuesta' : 'respuestas'}`}
            </button>
          ))}

        {!ultimoNivel && abierto && hijos && (
          <>
            {hijos.lista.map((hijo) => pintarRama(hijo, nivel + 1))}
            {hijos.lista.length < hijos.total && (
              <button
                type="button"
                className="hilo-enlace"
                onClick={() => cargarNivel(comentario._id, hijos.pagina + 1)}
              >
                Ver más respuestas ({hijos.total - hijos.lista.length})
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="comentarios">
      {raizActual && (
        <div className="hilo-volver">
          <button type="button" className="btn btn-plano btn-sm" onClick={() => setPila(pila.slice(0, -1))}>
            <Icono nombre="atras" tam={16} /> Volver
          </button>
          <span className="tarjeta-meta">Estás viendo una parte del hilo</span>
        </div>
      )}

      {error && <p className="mensaje-error">{error}</p>}

      {!nivelVisible ? (
        <p className="tarjeta-meta">Cargando {palabra}s...</p>
      ) : (
        <>
          {raizActual && pintarRama(raizActual, 0)}

          {!raizActual && nivelVisible.lista.length === 0 && (
            <p className="tarjeta-meta">
              Todavía no hay {palabra}s. {usuario ? 'Escribe la primera.' : ''}
            </p>
          )}

          {!raizActual && nivelVisible.lista.map((comentario) => pintarRama(comentario, 0))}

          {!raizActual && nivelVisible.lista.length < nivelVisible.total && (
            <button type="button" className="hilo-enlace" onClick={() => cargarNivel(null, nivelVisible.pagina + 1)}>
              Ver más {palabra}s ({nivelVisible.total - nivelVisible.lista.length})
            </button>
          )}
        </>
      )}

      {/* El formulario de abajo escribe siempre en el primer nivel. Dentro
          de un subhilo no se pinta: allí lo que se hace es responder a
          algo concreto, con el botón de cada comentario. */}
      {!raizActual &&
        (usuario ? (
          <Formulario
            permitirValoracion={permitirValoracion}
            palabra={palabra}
            usuario={usuario}
            onEnviar={(datos) => crear({ ...datos, padreId: null })}
          />
        ) : (
          <p className="tarjeta-meta">
            <Link to="/login">Inicia sesión</Link> para {permitirValoracion ? 'reseñar' : 'comentar'}.
          </p>
        ))}
    </div>
  );
}

// Un comentario del hilo. También pinta el hueco que queda cuando se ha
// retirado: la fila sigue ahí porque abajo puede colgar media
// conversación, pero el texto y el autor ya no llegan del servidor.
function Comentario({
  comentario,
  propietarioId,
  usuario,
  miReaccion,
  onReaccionar,
  respondiendo,
  onResponder,
  editando,
  onEditar,
  onCancelarEdicion,
  onGuardarEdicion,
  confirmando,
  onPedirBorrado,
  onCancelarBorrado,
  onConfirmarBorrado,
  onEnviarRespuesta,
}) {
  const [textoEdicion, setTextoEdicion] = useState(comentario.texto || '');

  if (comentario.retirado) {
    return (
      <div className="comentario">
        <div className="comentario-burbuja">
          <p className="comentario-retirado">
            {comentario.retirado === 'autor'
              ? 'Su autor retiró este comentario'
              : 'Un moderador retiró este comentario'}
          </p>
        </div>
      </div>
    );
  }

  const autorId = comentario.autor_id?._id || comentario.autor_id;
  const soyElAutor = Boolean(usuario && autorId && String(autorId) === String(usuario._id));
  const esEquipo = usuario?.rol === 'moderador' || usuario?.rol === 'admin';

  return (
    <div className="comentario">
      <Avatar usuario={comentario.autor_id} tamano="xs" />

      <div className="comentario-burbuja">
        <span className="comentario-autor">
          {autorId ? (
            <Link to={`/vecino/${autorId}`}>{comentario.autor_id?.nombre_usuario || 'Vecino'}</Link>
          ) : (
            comentario.autor_id?.nombre_usuario || 'Vecino'
          )}
          <InsigniaVerificado usuario={comentario.autor_id} />
          {comentario.autor_id?.oficial && <InsigniaOficial />}
          {propietarioId && String(autorId) === String(propietarioId) && (
            <span className="insignia insignia-marca" style={{ marginLeft: 4 }}>
              Propietario
            </span>
          )}
        </span>
        {comentario.valoracion > 0 && (
          <span className="estrellas" title={`${comentario.valoracion} de 5`}>
            {' '}
            {'★'.repeat(comentario.valoracion)}
            {'☆'.repeat(5 - comentario.valoracion)}
          </span>
        )}

        {editando ? (
          <form
            className="comentario-edicion"
            onSubmit={(evento) => {
              evento.preventDefault();
              onGuardarEdicion(textoEdicion);
            }}
          >
            <textarea
              rows={2}
              value={textoEdicion}
              maxLength={1000}
              onChange={(evento) => setTextoEdicion(evento.target.value)}
            />
            <div className="formulario-reporte-acciones">
              <button type="submit" className="btn btn-primario btn-sm" disabled={!textoEdicion.trim()}>
                Guardar
              </button>
              <button type="button" className="btn btn-contorno btn-sm" onClick={onCancelarEdicion}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <p className="comentario-texto">{comentario.texto}</p>
        )}

        <div className="comentario-pie">
          <time title={fechaCompleta(comentario.fecha_creacion)}>{haceCuanto(comentario.fecha_creacion)}</time>

          {/* Que está editado se dice: debajo puede haber respuestas a lo
              que decía antes. */}
          {comentario.editado && (
            <span title={comentario.editado_en ? `Editado el ${fechaCompleta(comentario.editado_en)}` : 'Editado'}>
              editado
            </span>
          )}

          <SelectorReaccion compacto valor={miReaccion} onElegir={onReaccionar} />
          <ResumenReacciones resumen={comentario.reacciones_resumen} clase="resumen-reacciones-mini" />

          {usuario && (
            <button type="button" className="reaccion-compacta" onClick={onResponder}>
              Responder
            </button>
          )}

          {soyElAutor && !editando && (
            <button type="button" className="reaccion-compacta" onClick={onEditar}>
              Editar
            </button>
          )}

          {(soyElAutor || esEquipo) &&
            (confirmando ? (
              // Preguntar aquí mismo, no con un confirm() del navegador:
              // ese bloquea la página y se lee como un error del sistema.
              <span className="comentario-confirmar">
                ¿Seguro?
                <button type="button" className="reaccion-compacta" onClick={onConfirmarBorrado}>
                  Sí, borrar
                </button>
                <button type="button" className="reaccion-compacta" onClick={onCancelarBorrado}>
                  No
                </button>
              </span>
            ) : (
              <button type="button" className="reaccion-compacta" onClick={onPedirBorrado}>
                Borrar
              </button>
            ))}

          <BotonReportar contenidoTipo="comentario" contenidoId={comentario._id} compacto />
        </div>

        {respondiendo && (
          <Formulario
            usuario={usuario}
            palabra="respuesta"
            autoFoco
            onEnviar={async ({ texto }) => {
              await onEnviarRespuesta(texto);
              onResponder();
            }}
          />
        )}
      </div>
    </div>
  );
}

// Escribir un comentario, una reseña o una respuesta: el mismo formulario
// para los tres, que solo cambian en el texto del marcador y en si pide
// estrellas.
function Formulario({ usuario, palabra, permitirValoracion = false, autoFoco = false, onEnviar }) {
  const [texto, setTexto] = useState('');
  const [valoracion, setValoracion] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const enviar = async (evento) => {
    evento.preventDefault();
    if (!texto.trim() || enviando) return;

    setEnviando(true);
    setError(null);

    try {
      await onEnviar({ texto, valoracion });
      setTexto('');
      setValoracion(0);
    } catch (err) {
      setError(err.response?.data?.mensaje || `No se pudo publicar tu ${palabra}.`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <form onSubmit={enviar} className="formulario-comentario">
        <Avatar usuario={usuario} tamano="xs" />

        {permitirValoracion && (
          <span className="selector-estrellas">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setValoracion(n)} title={`${n} de 5`}>
                {n <= valoracion ? '★' : '☆'}
                <span className="solo-lectores">{`Puntuar con ${n}`}</span>
              </button>
            ))}
          </span>
        )}

        <input
          value={texto}
          autoFocus={autoFoco}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder={`Escribe tu ${palabra}...`}
          aria-label={`Escribe tu ${palabra}`}
          maxLength={1000}
        />

        <button type="submit" className="btn-icono" disabled={enviando || !texto.trim()} title="Enviar">
          <Icono nombre="enviar" />
          <span className="solo-lectores">Enviar</span>
        </button>
      </form>

      {error && <p className="mensaje-error">{error}</p>}
    </>
  );
}

export default HiloComentarios;
