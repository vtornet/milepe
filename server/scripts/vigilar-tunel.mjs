// Vigila el tunel SSH a la MongoDB de Railway (railway connect --tunnel-only)
// y lo reinicia solo si deja de responder. El tunel se cae de vez en cuando
// por si mismo (ver CLAUDE.md "That tunnel drops on its own occasionally"):
// a veces el proceso sigue vivo pero deja de reenviar trafico de verdad, asi
// que no basta con vigilar si el proceso sigue en pie, hay que comprobar el
// puerto de verdad.
//
// Uso: node scripts/vigilar-tunel.mjs [puerto]
import { spawn } from 'child_process';
import net from 'net';

const PUERTO = Number(process.argv[2]) || 27018;
const INTERVALO_MS = 15000;
const TIMEOUT_COMPROBACION_MS = 4000;

let procesoActual = null;

const comprobarPuerto = () =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: PUERTO, timeout: TIMEOUT_COMPROBACION_MS });
    socket.on('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(false));
  });

const lanzarTunel = () => {
  console.log(`[vigilante] Lanzando tunel en el puerto ${PUERTO}...`);
  procesoActual = spawn('railway', ['connect', 'MongoDB', '--tunnel-only', '--port', String(PUERTO)], {
    stdio: 'inherit',
    shell: true,
  });
  procesoActual.on('exit', (codigo) => {
    console.log(`[vigilante] El proceso del tunel termino (codigo ${codigo})`);
    procesoActual = null;
  });
};

const ciclo = async () => {
  const vivo = await comprobarPuerto();
  if (vivo) return;

  console.log('[vigilante] El tunel no responde, reiniciando...');
  if (procesoActual) {
    try {
      procesoActual.kill();
    } catch {
      // ya estaba muerto, no pasa nada
    }
  }
  lanzarTunel();
};

lanzarTunel();
setInterval(ciclo, INTERVALO_MS);

process.on('SIGINT', () => {
  if (procesoActual) procesoActual.kill();
  process.exit(0);
});
