import { useEffect, useRef, useState } from 'react';

const ID_SCRIPT = 'gsi-client';
const URL_SCRIPT = 'https://accounts.google.com/gsi/client';

// Carga el script de Google una sola vez, aunque el botón se monte en
// varias pantallas (entrar y registrarse). La promesa se guarda en el
// módulo: la segunda llamada reutiliza la primera en vez de insertar otro
// <script>.
let promesaScript = null;

const cargarScriptGoogle = () => {
  if (promesaScript) return promesaScript;

  promesaScript = new Promise((resolver, rechazar) => {
    if (document.getElementById(ID_SCRIPT)) {
      resolver();
      return;
    }

    const script = document.createElement('script');
    script.id = ID_SCRIPT;
    script.src = URL_SCRIPT;
    script.async = true;
    script.onload = resolver;
    script.onerror = () => rechazar(new Error('No se pudo cargar el script de Google'));
    document.head.appendChild(script);
  });

  return promesaScript;
};

/**
 * Botón "Continuar con Google".
 *
 * Usa Google Identity Services y el flujo de ID token: Google devuelve un
 * token firmado que se manda al backend, que lo verifica y responde con la
 * sesión de MiLepe. No hay redirección ni vuelta: el vecino no sale de la
 * página, que en un móvil es bastante más agradable.
 *
 * El script de Google se carga aquí, al montar el botón, y no en
 * index.html: así quien solo viene a leer el muro no descarga nada de
 * Google ni recibe sus cookies.
 */
function BotonGoogle({ onCredencial }) {
  const contenedor = useRef(null);
  const [error, setError] = useState(null);

  // onCredencial se guarda en una ref para que el efecto no dependa de
  // ella: si dependiera, cada render del padre volvería a inicializar el
  // botón de Google y este parpadearía.
  const alRecibir = useRef(onCredencial);
  alRecibir.current = onCredencial;

  const clienteId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clienteId) return;

    let cancelado = false;

    cargarScriptGoogle()
      .then(() => {
        if (cancelado || !contenedor.current || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: clienteId,
          callback: (respuesta) => alRecibir.current(respuesta.credential),
        });

        window.google.accounts.id.renderButton(contenedor.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          locale: 'es',
          // Google mide el botón al dibujarlo y no se adapta solo después,
          // así que se le da un ancho fijo que cabe en la tarjeta de
          // acceso (400 px menos su padding).
          width: 320,
        });
      })
      .catch(() => {
        if (!cancelado) setError('No se ha podido cargar el acceso con Google.');
      });

    return () => {
      cancelado = true;
    };
  }, [clienteId]);

  // Sin ID configurado no se enseña nada: es preferible a un botón que al
  // pulsarlo no hace nada. En desarrollo se avisa por consola, donde lo ve
  // quien está programando y no el vecino.
  if (!clienteId) {
    if (import.meta.env.DEV) {
      console.warn('[auth] VITE_GOOGLE_CLIENT_ID no está definida: no se muestra el acceso con Google.');
    }
    return null;
  }

  return (
    <div className="acceso-google">
      <div ref={contenedor} style={{ display: 'flex', justifyContent: 'center' }} />
      {error && <p className="mensaje-error">{error}</p>}
      <div className="separador-o">
        <span>o</span>
      </div>
    </div>
  );
}

export default BotonGoogle;
