// Capa de tiempo real.
//
// Hoy no hay tiempo real: el cliente sondea (ConversacionPage pide los
// mensajes cada 10 s). Esto existe para que el dia que se enchufe
// socket.io -o SSE, o lo que sea- no haya que buscar por los controladores
// donde avisar: ya hay un sitio al que se le cuenta todo lo que pasa, y es
// ese sitio el que decide si hay por donde mandarlo.
//
// Deliberadamente SIN socket.io instalado. Meter la dependencia ahora
// significa un servidor con websockets abiertos que nadie escucha, y en
// Railway eso son conexiones vivas que se facturan para nada. El
// adaptador se registra desde server.js cuando llegue el momento:
//
//   import { Server } from 'socket.io';
//   const io = new Server(servidorHttp);
//   registrarAdaptador((usuarioId, evento, datos) => {
//     io.to(`usuario:${usuarioId}`).emit(evento, datos);
//   });
//
// Mientras no haya adaptador, emitir() no hace nada y lo dice en
// desarrollo. No es un error: el sondeo del cliente ya entrega el mensaje
// unos segundos despues.

let adaptador = null;

export const registrarAdaptador = (fn) => {
  adaptador = fn;
};

export const hayTiempoReal = () => adaptador !== null;

// Avisa a un vecino de que ha pasado algo. El evento se nombra igual que
// el tipo de notificacion correspondiente ('mensaje_nuevo',
// 'seguidor_nuevo') para que cliente y servidor no manejen dos
// vocabularios para lo mismo.
export const emitir = (usuarioId, evento, datos = {}) => {
  if (!adaptador) {
    if (process.env.NODE_ENV !== 'production' && process.env.TIEMPO_REAL_VERBOSO === 'true') {
      console.log(`[tiempo-real] (sin adaptador) ${evento} -> ${usuarioId}`);
    }
    return false;
  }

  try {
    adaptador(String(usuarioId), evento, datos);
    return true;
  } catch (error) {
    // Igual que el push: un fallo avisando no puede tumbar la peticion que
    // lo provoco.
    console.error('[tiempo-real] Fallo al emitir:', error.message);
    return false;
  }
};
