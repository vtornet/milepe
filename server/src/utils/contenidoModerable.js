import Post from '../models/Post.js';
import Comentario from '../models/Comentario.js';
import Mensaje from '../models/Mensaje.js';
import Conversacion from '../models/Conversacion.js';
import { TIPOS_CONTENIDO_MODERABLE } from '../models/constantes.js';
import ErrorHttp from './ErrorHttp.js';

// La moderacion es generica -un reporte, una accion o una apelacion
// funcionan igual sobre un post que sobre un comentario o un mensaje- y lo
// que lo hace posible es que los tres modelos comparten los tres campos
// que a la moderacion le importan: autor_id, estado_moderacion y
// moderador_id. Este modulo es el unico sitio que traduce un
// contenido_tipo al modelo que le corresponde, para que ni los modelos ni
// los controladores repartan ese switch por todas partes.
const MODELOS = {
  post: Post,
  comentario: Comentario,
  mensaje: Mensaje,
};

export const modeloDe = (contenidoTipo) => MODELOS[contenidoTipo] || null;

// Carga el contenido reportado/moderado, o lanza el error HTTP que
// corresponda: 400 si el tipo no es moderable, 404 si no existe. A
// diferencia de la lectura publica, aqui un contenido 'eliminado' SI se
// devuelve: un moderador tiene que poder verlo para revisarlo, y su autor
// para apelarlo.
export const cargarModerable = async (contenidoTipo, contenidoId) => {
  const Modelo = modeloDe(contenidoTipo);

  if (!Modelo) {
    throw new ErrorHttp(400, `contenido_tipo debe ser uno de: ${TIPOS_CONTENIDO_MODERABLE.join(', ')}`);
  }

  const contenido = await Modelo.findById(contenidoId);

  if (!contenido) {
    throw new ErrorHttp(404, 'El contenido indicado no existe');
  }

  return contenido;
};

// Quien tiene derecho a reportar un contenido.
//
// Para un post o un comentario la pregunta no existia: son publicos, los
// ve cualquiera, asi que cualquiera puede reportarlos. Un mensaje privado
// no: solo lo han visto dos personas, y solo una de ellas -la que lo
// recibio- tiene algo que reportar.
//
// Esto no es un detalle de cortesia. Sin la comprobacion, cualquiera con
// el id de un mensaje podria meterlo en la cola de moderacion y conseguir
// que un moderador lea una conversacion privada ajena. El umbral de
// reportes automatico lo haria incluso sin moderador de por medio.
export const puedeReportar = async (contenidoTipo, contenido, usuarioId) => {
  if (contenidoTipo !== 'mensaje') return true;

  const conversacion = await Conversacion.findOne({
    _id: contenido.conversacion_id,
    participantes: usuarioId,
  }).select('_id');

  return Boolean(conversacion);
};
