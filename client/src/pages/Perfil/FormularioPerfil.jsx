import { useState } from 'react';
import api from '../../services/api.js';
import SelectorAvatar from '../../components/SelectorAvatar.jsx';
import Icono from '../../components/Icono.jsx';

// El formulario del perfil, compartido por la pantalla de alta
// (/completar-perfil) y por la de edición (/perfil). Es el mismo
// formulario: lo único que cambia es el texto de alrededor y si el nombre
// de usuario se puede tocar.
//
// Esa es justamente la diferencia que hay que dejar clarísima: el nombre
// de usuario se elige UNA vez. Mientras se puede elegir, el aviso sale en
// amarillo encima del campo; después, el campo aparece bloqueado y se
// explica por qué, en vez de desaparecer sin más.
function FormularioPerfil({ perfil, onGuardado, textoBoton = 'Guardar' }) {
  const bloqueado = Boolean(perfil.perfil_completo);

  const [datos, setDatos] = useState({
    nombre_usuario: perfil.nombre_usuario || '',
    nombre: perfil.nombre || '',
    apellidos: perfil.apellidos || '',
    avatar_url: perfil.avatar_url || '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const cambiar = (campo) => (evento) => setDatos({ ...datos, [campo]: evento.target.value });

  // Misma normalización que el registro: el servidor solo admite letras,
  // números, puntos, guiones y guiones bajos, así que se limpia mientras
  // se escribe en vez de dejar que choque al enviar.
  const cambiarUsuario = (evento) => {
    const limpio = evento.target.value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .toLowerCase();
    setDatos({ ...datos, nombre_usuario: limpio });
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    setError(null);

    if (datos.nombre_usuario.length < 3) {
      setError('El nombre de usuario debe tener al menos 3 caracteres.');
      return;
    }
    if (!datos.nombre.trim() || !datos.apellidos.trim()) {
      setError('Hacen falta tu nombre y tus apellidos.');
      return;
    }
    if (!datos.avatar_url) {
      setError('Elige una foto de perfil.');
      return;
    }

    setGuardando(true);
    try {
      const cuerpo = { nombre: datos.nombre, apellidos: datos.apellidos, avatar_url: datos.avatar_url };
      // El nombre de usuario solo se manda si todavía se puede elegir: si
      // no, el servidor devolvería un 400 por intentar cambiarlo aunque
      // fuera por el mismo valor.
      if (!bloqueado) cuerpo.nombre_usuario = datos.nombre_usuario;

      const { data } = await api.put('/usuarios/perfil', cuerpo);
      onGuardado(data.usuario);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo guardar el perfil.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={enviar}>
      <label htmlFor="avatar">Foto de perfil</label>
      <SelectorAvatar
        url={datos.avatar_url}
        nombreUsuario={datos.nombre_usuario}
        onCambio={(url) => setDatos({ ...datos, avatar_url: url })}
      />

      <label htmlFor="nombre_usuario">Nombre de usuario</label>
      {bloqueado ? (
        <>
          <input id="nombre_usuario" value={datos.nombre_usuario} disabled />
          <small>
            El nombre de usuario no se puede cambiar. Es como te conocen el resto de vecinos y aparece en todo lo
            que has publicado.
          </small>
        </>
      ) : (
        <>
          <div className="aviso aviso-aviso" style={{ marginBottom: 'var(--e-2)' }}>
            <Icono nombre="alerta" tam={18} />
            <span>
              <strong>Elígelo con calma: no se puede cambiar después.</strong> Es el nombre con el que te verán
              el resto de vecinos y el que aparecerá en todo lo que publiques.
            </span>
          </div>
          <input
            id="nombre_usuario"
            value={datos.nombre_usuario}
            onChange={cambiarUsuario}
            required
            minLength={3}
            maxLength={30}
            autoComplete="username"
          />
          <small>Sin espacios ni acentos: se convierten solos mientras escribes.</small>
        </>
      )}

      <label htmlFor="nombre">Nombre real</label>
      <input id="nombre" value={datos.nombre} onChange={cambiar('nombre')} required maxLength={60} autoComplete="given-name" />

      <label htmlFor="apellidos">Apellidos reales</label>
      <input
        id="apellidos"
        value={datos.apellidos}
        onChange={cambiar('apellidos')}
        required
        maxLength={80}
        autoComplete="family-name"
      />

      <div className="aviso aviso-info" style={{ marginTop: 'var(--e-3)' }}>
        <Icono nombre="moderacion" tam={18} />
        <span>
          <strong>Tu nombre y tus apellidos no son públicos.</strong> No aparecen en tus publicaciones, ni en tus
          comentarios, ni en tu perfil: los demás vecinos solo ven tu nombre de usuario y tu foto. Los pedimos
          para que detrás de cada cuenta haya una persona real.
        </span>
      </div>

      {error && <p className="mensaje-error">{error}</p>}

      <button type="submit" disabled={guardando}>
        {guardando ? 'Guardando...' : textoBoton}
      </button>
    </form>
  );
}

export default FormularioPerfil;
