import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useReacciones } from '../context/ReaccionesContext.jsx';
import Icono from './Icono.jsx';
import SelectorReaccion from './SelectorReaccion.jsx';
import ResumenReacciones from './ResumenReacciones.jsx';
import HiloComentarios from './HiloComentarios.jsx';

// Barra de reacciones y comentarios, compartida por todas las secciones
// porque todas hablan con el mismo router genérico de posts
// (/api/posts/:id/reaccion y /comentarios).
//
// El hilo en sí vive en HiloComentarios: se cargan por niveles, con
// respuestas, paginación y "continuar hilo", y eso era demasiado para
// dejarlo aquí mezclado con la barra.
//
// permitirValoracion activa el selector de estrellas al comentar (reseñas
// de Negocios); el resto de secciones no lo pasan.
function PanelInteraccion({ postId, reaccionesIniciales, numComentarios = 0, permitirValoracion = false, propietarioId = null }) {
  const { usuario } = useAuth();
  const { mias, anotar } = useReacciones();

  const [reacciones, setReacciones] = useState(reaccionesIniciales || {});
  const [hiloAbierto, setHiloAbierto] = useState(false);
  // Se lleva por diferencias y no releyendo el post: el número de arriba
  // tiene que moverse al escribir o borrar, y volver a pedir la
  // publicación entera para cambiar un dígito sería desproporcionado.
  const [cuantos, setCuantos] = useState(numComentarios);
  const [aviso, setAviso] = useState(null);

  const reaccionar = async (tipo) => {
    if (!usuario) {
      // Un alert() del navegador para "inicia sesión" es lo más brusco que
      // puede hacer una interfaz: bloquea la página y se lee como un error
      // del sistema. El aviso sale dentro de la propia tarjeta.
      setAviso('Inicia sesión para participar.');
      return;
    }

    try {
      const { data } = await api.post(`/posts/${postId}/reaccion`, { tipo });
      setReacciones(data.reacciones);
      // El servidor alterna: repetir la misma la quita, otra distinta la
      // cambia. Devuelve el tipo que queda (null si se quitó), que es lo
      // que se guarda, en vez de darlo por hecho aquí.
      anotar('posts', postId, data.tipo);
      setAviso(null);
    } catch (err) {
      setAviso(err.response?.data?.mensaje || 'No se pudo registrar tu reacción.');
    }
  };

  return (
    <>
      <ResumenReacciones resumen={reacciones} />

      <div className="acciones">
        <SelectorReaccion valor={mias.posts[postId] || null} onElegir={reaccionar} />

        <button type="button" className="accion" onClick={() => setHiloAbierto(!hiloAbierto)}>
          <Icono nombre="comentario" tam={18} />
          {cuantos > 0 && <span className="accion-cuenta">{cuantos}</span>}
          {permitirValoracion ? 'Reseñas' : 'Comentar'}
        </button>
      </div>

      {aviso && (
        <p className="tarjeta-meta" style={{ padding: '0 var(--e-4) var(--e-3)' }}>
          {aviso} {!usuario && <Link to="/login">Entrar</Link>}
        </p>
      )}

      {hiloAbierto && (
        <HiloComentarios
          postId={postId}
          permitirValoracion={permitirValoracion}
          propietarioId={propietarioId}
          onDelta={(delta) => setCuantos((anterior) => Math.max(0, anterior + delta))}
        />
      )}
    </>
  );
}

export default PanelInteraccion;
