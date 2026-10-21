import { useState } from 'react';
import api from '../services/api.js';
import Icono from './Icono.jsx';

// Formulario para editar una publicación. Uno solo para las seis
// secciones, porque solo toca lo que vive en Post: título, texto e
// imágenes. Los campos propios de cada sección (la categoría de una queja,
// la fecha de un evento, la dirección de un negocio) están en su
// *_detalle y no se editan desde aquí.
//
// Manda al servidor únicamente lo que ha cambiado. Si enviara siempre las
// tres cosas, corregir una tilde contaría como cambio de fotos y mandaría
// la publicación a la cola de revisión sin motivo.
function EditarPublicacion({ post, onGuardado, onCancelar }) {
  const [titulo, setTitulo] = useState(post.titulo || '');
  const [contenido, setContenido] = useState(post.contenido || '');
  const [imagenes, setImagenes] = useState(post.imagenes || []);
  const [archivos, setArchivos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const originales = post.imagenes || [];
  // Cambian si se ha quitado alguna de las que había o si se añade alguna
  // nueva. Se calcula aquí, mientras se edita, para poder avisar ANTES de
  // guardar: que tu publicación entre en revisión es exactamente lo que no
  // se puede descubrir cuando ya es tarde.
  const imagenesCambian = imagenes.length !== originales.length || archivos.length > 0;

  const guardar = async (evento) => {
    evento.preventDefault();
    setError(null);

    // El servidor lo rechaza igual (es la regla de la sección Fotos), pero
    // decirlo aquí evita el viaje y la subida de archivos para nada.
    if (post.tipo === 'foto' && imagenes.length === 0 && archivos.length === 0) {
      setError('Una publicación de Fotos no puede quedarse sin imágenes.');
      return;
    }

    setGuardando(true);

    try {
      let listaFinal = imagenes;

      if (archivos.length > 0) {
        const formData = new FormData();
        archivos.forEach((archivo) => formData.append('imagenes', archivo));

        const { data: subida } = await api.post('/subidas/imagenes', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        listaFinal = [...imagenes, ...subida.imagenes];
      }

      const cambios = {};
      if (titulo !== (post.titulo || '')) cambios.titulo = titulo;
      if (contenido !== (post.contenido || '')) cambios.contenido = contenido;
      if (imagenesCambian) cambios.imagenes = listaFinal;

      // Abrir el formulario y cerrarlo sin tocar nada no es un error ni
      // una edición: el servidor contestaría 400 y aquí se vería como un
      // fallo que no ha ocurrido.
      if (Object.keys(cambios).length === 0) {
        onCancelar();
        return;
      }

      const { data } = await api.patch(`/posts/${post._id}`, cambios);
      onGuardado(data.post);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo guardar el cambio.');
      setGuardando(false);
    }
  };

  return (
    <form className="formulario-edicion" onSubmit={guardar}>
      <label>
        Título
        <input value={titulo} maxLength={120} onChange={(evento) => setTitulo(evento.target.value)} />
      </label>

      <label>
        Texto
        <textarea
          rows={4}
          value={contenido}
          maxLength={5000}
          onChange={(evento) => setContenido(evento.target.value)}
        />
      </label>

      {imagenes.length > 0 && (
        <div className="edicion-imagenes">
          {imagenes.map((url) => (
            <div key={url} className="edicion-imagen">
              <img src={url} alt="" />
              <button
                type="button"
                className="edicion-quitar"
                title="Quitar esta imagen"
                onClick={() => setImagenes(imagenes.filter((otra) => otra !== url))}
              >
                <Icono nombre="cerrar" tam={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <label>
        Añadir fotos
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(evento) => setArchivos(Array.from(evento.target.files))}
        />
      </label>

      {imagenesCambian && (
        <div className="aviso aviso-aviso">
          <Icono nombre="alerta" tam={18} />
          <span>
            Al cambiar las fotos, un moderador revisará la publicación. <strong>Seguirá visible</strong> mientras
            tanto; no desaparece del muro.
          </span>
        </div>
      )}

      {error && <p className="mensaje-error">{error}</p>}

      <div className="formulario-reporte-acciones">
        <button type="submit" className="btn btn-primario btn-sm" disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button type="button" className="btn btn-contorno btn-sm" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default EditarPublicacion;
