import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import { SECCIONES_TURISMO } from '../Turismo/seccionesTurismo.js';

// Etiquetas legibles de las claves que llegan del servidor. Las que no
// estén aquí se pintan tal cual, para que un valor nuevo no desaparezca.
const ETIQUETAS = {
  rol: { usuario: 'Vecinos', moderador: 'Moderadores', admin: 'Administradores' },
  tipo: {
    muro: 'Muro',
    queja: 'Quejas',
    foto: 'Fotos',
    evento: 'Eventos',
    negocio: 'Negocios',
    empleo_busco: 'Empleo (busco)',
    empleo_ofrezco: 'Empleo (ofrezco)',
  },
  estadoPost: { publicado: 'Publicados', oculto: 'Ocultos', eliminado: 'Eliminados' },
  reaccion: {
    me_gusta: '👍 Me gusta',
    me_encanta: '❤️ Me encanta',
    jaja: '😂 Jaja',
    vaya: '😮 Vaya',
    apoyo: '🤝 Apoyo',
    triste: '😢 Triste',
    enfado: '😠 Enfado',
  },
  estadoQueja: { pendiente: 'Pendientes', en_curso: 'En curso', resuelto: 'Resueltas' },
  estadoReporte: { pendiente: 'Pendientes', aceptado: 'Aceptados', rechazado: 'Rechazados' },
  estadoApelacion: { pendiente: 'Pendientes', aceptada: 'Aceptadas', rechazada: 'Rechazadas' },
  modalidad: { busco: 'Busco trabajo', ofrezco: 'Ofrezco trabajo' },
  estadoOferta: { activa: 'Activas', caducada: 'Caducadas' },
};

const etiquetar = (mapa, clave) => mapa?.[clave] || clave.replaceAll('_', ' ');

const nf = new Intl.NumberFormat('es-ES');

function Cifra({ valor, etiqueta, detalle }) {
  return (
    <div className="estad-cifra">
      <strong>{typeof valor === 'number' ? nf.format(valor) : valor}</strong>
      <span>{etiqueta}</span>
      {detalle && <small>{detalle}</small>}
    </div>
  );
}

// Barras horizontales de { clave: n }, ordenadas de mayor a menor.
function Barras({ datos, etiquetas, vacio = 'Sin datos todavía.' }) {
  const filas = Object.entries(datos || {}).sort((a, b) => b[1] - a[1]);
  if (filas.length === 0) return <p className="tarjeta-meta">{vacio}</p>;
  const maximo = Math.max(...filas.map(([, n]) => n), 1);

  return (
    <ul className="estad-barras">
      {filas.map(([clave, n]) => (
        <li key={clave}>
          <span className="estad-barra-etiqueta">{etiquetar(etiquetas, clave)}</span>
          <span className="estad-barra-pista" aria-hidden="true">
            <span style={{ width: `${(n / maximo) * 100}%` }} />
          </span>
          <span className="estad-barra-valor">{nf.format(n)}</span>
        </li>
      ))}
    </ul>
  );
}

// Una barra por día. El total y el pico van en texto para que no dependa
// de ver el dibujo.
function SerieDiaria({ serie, titulo }) {
  const total = serie.reduce((suma, d) => suma + d.n, 0);
  const pico = Math.max(...serie.map((d) => d.n), 1);
  const ancho = 300;
  const alto = 60;
  const paso = ancho / serie.length;

  return (
    <figure className="estad-serie">
      <figcaption>
        {titulo} <small>({nf.format(total)} en 30 días)</small>
      </figcaption>
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={`${titulo}: ${total} en los últimos 30 días`}>
        {serie.map((d, i) => {
          const h = d.n === 0 ? 1 : Math.max(3, (d.n / pico) * (alto - 4));
          return (
            <rect key={d.dia} x={i * paso + 1} y={alto - h} width={paso - 2} height={h} rx="1">
              <title>{`${d.dia}: ${d.n}`}</title>
            </rect>
          );
        })}
      </svg>
    </figure>
  );
}

function Bloque({ titulo, children }) {
  return (
    <section className="tarjeta estad-bloque">
      <h2>{titulo}</h2>
      {children}
    </section>
  );
}

// Estadísticas de toda la red. Solo para administradores (la API también
// lo exige). De la mensajería se muestran volúmenes, nunca contenido.
function EstadisticasPanel() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    api
      .get('/estadisticas')
      .then(({ data }) => {
        if (!cancelado) setDatos(data);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudieron cargar las estadísticas.');
      });

    return () => {
      cancelado = true;
    };
  }, []);

  if (error) return <p className="mensaje-error">{error}</p>;
  if (!datos) return <p>Cargando estadísticas...</p>;

  const { usuarios, contenido, social, moderacion, secciones } = datos;
  const postsPublicados = contenido.posts_por_estado.publicado || 0;
  const pct = (parte, total) => (total ? `${Math.round((parte / total) * 100)} %` : '—');
  const turismo = Object.fromEntries(
    SECCIONES_TURISMO.map((s) => [s.valor, secciones.turismo.recursos_activos_por_seccion[s.valor] || 0]),
  );
  const etiquetasTurismo = Object.fromEntries(SECCIONES_TURISMO.map((s) => [s.valor, s.etiqueta]));

  return (
    <div className="estadisticas">
      <p className="tarjeta-meta">
        Generado el {new Date(datos.generado_en).toLocaleString('es-ES')}. Recarga la pestaña para actualizar.
      </p>

      <Bloque titulo="Vecinos">
        <div className="estad-cifras">
          <Cifra valor={usuarios.total} etiqueta="cuentas" detalle={`${usuarios.desactivados} desactivadas`} />
          <Cifra valor={usuarios.nuevos_7_dias} etiqueta="nuevas esta semana" detalle={`${usuarios.nuevos_30_dias} en 30 días`} />
          <Cifra
            valor={usuarios.participantes_30_dias}
            etiqueta="participantes (30 días)"
            detalle={`${usuarios.participantes_7_dias} en 7 días · ${pct(usuarios.participantes_30_dias, usuarios.activos)} de las activas`}
          />
          <Cifra
            valor={usuarios.email_verificado}
            etiqueta="con correo verificado"
            detalle={pct(usuarios.email_verificado, usuarios.total)}
          />
          <Cifra
            valor={usuarios.perfil_completo}
            etiqueta="con perfil completo"
            detalle={pct(usuarios.perfil_completo, usuarios.total)}
          />
          <Cifra valor={usuarios.con_google} etiqueta="entran con Google" detalle={pct(usuarios.con_google, usuarios.total)} />
        </div>
        <SerieDiaria serie={usuarios.serie_altas} titulo="Altas por día" />
        <h3>Por rol</h3>
        <Barras datos={usuarios.por_rol} etiquetas={ETIQUETAS.rol} />
      </Bloque>

      <Bloque titulo="Publicaciones">
        <div className="estad-cifras">
          <Cifra valor={postsPublicados} etiqueta="publicaciones visibles" />
          <Cifra
            valor={contenido.posts_nuevos_7_dias}
            etiqueta="nuevas esta semana"
            detalle={`${contenido.posts_nuevos_30_dias} en 30 días`}
          />
          <Cifra valor={contenido.posts_editados} etiqueta="editadas" detalle={`${contenido.ediciones_pendientes} por revisar`} />
          <Cifra
            valor={contenido.posts_por_estado.oculto || 0}
            etiqueta="ocultas"
            detalle={`${contenido.posts_por_estado.eliminado || 0} eliminadas`}
          />
        </div>
        <SerieDiaria serie={contenido.serie_posts} titulo="Publicaciones por día" />
        <h3>Por sección</h3>
        <Barras datos={contenido.posts_publicados_por_tipo} etiquetas={ETIQUETAS.tipo} />
      </Bloque>

      <Bloque titulo="Conversación">
        <div className="estad-cifras">
          <Cifra
            valor={contenido.comentarios.visibles}
            etiqueta="comentarios"
            detalle={`${contenido.comentarios.retirados} retirados`}
          />
          <Cifra
            valor={contenido.comentarios.nuevos_7_dias}
            etiqueta="nuevos esta semana"
            detalle={`${contenido.comentarios.nuevos_30_dias} en 30 días`}
          />
          <Cifra
            valor={contenido.reacciones.total}
            etiqueta="reacciones"
            detalle={`${contenido.reacciones.nuevas_7_dias} esta semana`}
          />
          <Cifra
            valor={postsPublicados ? (contenido.comentarios.visibles / postsPublicados).toFixed(1) : '—'}
            etiqueta="comentarios por publicación"
          />
        </div>
        <SerieDiaria serie={contenido.comentarios.serie} titulo="Comentarios por día" />
        <h3>Reacciones por tipo</h3>
        <Barras datos={contenido.reacciones.por_tipo} etiquetas={ETIQUETAS.reaccion} />
      </Bloque>

      <Bloque titulo="Lo que más se mueve (últimos 30 días)">
        <h3>Autores con más publicaciones</h3>
        {contenido.top_autores_30_dias.length === 0 ? (
          <p className="tarjeta-meta">Sin datos todavía.</p>
        ) : (
          <ol className="estad-lista">
            {contenido.top_autores_30_dias.map((a) => (
              <li key={a.nombre_usuario}>
                {a.nombre_usuario} <small>{a.n} publicaciones</small>
              </li>
            ))}
          </ol>
        )}
        <h3>Publicaciones con más interacción</h3>
        {contenido.top_posts_30_dias.length === 0 ? (
          <p className="tarjeta-meta">Sin datos todavía.</p>
        ) : (
          <ol className="estad-lista">
            {contenido.top_posts_30_dias.map((p) => (
              <li key={p._id}>
                {p.titulo || 'Sin título'}{' '}
                <small>
                  {etiquetar(ETIQUETAS.tipo, p.tipo)} · {p.nombre_usuario} · {p.reacciones} reacciones, {p.comentarios}{' '}
                  comentarios
                </small>
              </li>
            ))}
          </ol>
        )}
      </Bloque>

      <Bloque titulo="Red social y mensajes">
        <div className="estad-cifras">
          <Cifra valor={social.seguimientos} etiqueta="seguimientos" detalle={`${social.seguimientos_mutuos} parejas se siguen`} />
          <Cifra valor={social.conversaciones} etiqueta="conversaciones" />
          <Cifra valor={social.mensajes} etiqueta="mensajes" detalle={`${social.mensajes_7_dias} esta semana`} />
          <Cifra valor={social.bloqueos} etiqueta="bloqueos" />
          <Cifra
            valor={social.usuarios_con_push}
            etiqueta="con avisos push"
            detalle={pct(social.usuarios_con_push, usuarios.activos)}
          />
        </div>
        <p className="tarjeta-meta">De los mensajes privados solo se cuentan los volúmenes, nunca su contenido.</p>
      </Bloque>

      <Bloque titulo="Moderación">
        <div className="estad-cifras">
          <Cifra valor={moderacion.reportes_por_estado.pendiente || 0} etiqueta="reportes pendientes" />
          <Cifra valor={moderacion.apelaciones_por_estado.pendiente || 0} etiqueta="apelaciones pendientes" />
          <Cifra valor={contenido.ediciones_pendientes} etiqueta="ediciones por revisar" />
        </div>
        <h3>Reportes</h3>
        <Barras datos={moderacion.reportes_por_estado} etiquetas={ETIQUETAS.estadoReporte} vacio="Ningún reporte todavía." />
        <h3>Motivos de reporte</h3>
        <Barras datos={moderacion.reportes_por_motivo} vacio="Ningún reporte todavía." />
        <h3>Apelaciones</h3>
        <Barras datos={moderacion.apelaciones_por_estado} etiquetas={ETIQUETAS.estadoApelacion} vacio="Ninguna apelación todavía." />
        <h3>Acciones del equipo (30 días)</h3>
        <Barras datos={moderacion.acciones_30_dias} vacio="Sin acciones en los últimos 30 días." />
      </Bloque>

      <Bloque titulo="Quejas">
        <div className="estad-cifras">
          <Cifra
            valor={secciones.quejas.resolucion_media ? `${secciones.quejas.resolucion_media.dias} días` : '—'}
            etiqueta="tiempo medio de resolución"
            detalle={secciones.quejas.resolucion_media ? `sobre ${secciones.quejas.resolucion_media.n} resueltas` : 'aún no hay resueltas'}
          />
        </div>
        <h3>Por estado</h3>
        <Barras datos={secciones.quejas.por_estado} etiquetas={ETIQUETAS.estadoQueja} vacio="Ninguna queja todavía." />
        <h3>Por categoría</h3>
        <Barras datos={secciones.quejas.por_categoria} vacio="Ninguna queja todavía." />
      </Bloque>

      <Bloque titulo="Otras secciones">
        <div className="estad-cifras">
          <Cifra valor={secciones.eventos.total} etiqueta="eventos" detalle={`${secciones.eventos.proximos} próximos`} />
          <Cifra valor={secciones.negocios.total} etiqueta="negocios" detalle={`${secciones.negocios.destacados} destacados ahora`} />
          <Cifra
            valor={secciones.contactos.activos}
            etiqueta="contactos de interés"
            detalle={`${secciones.contactos.inactivos} inactivos por verificar`}
          />
          <Cifra
            valor={Object.values(turismo).reduce((s, n) => s + n, 0)}
            etiqueta="recursos de turismo"
            detalle={`${secciones.turismo.ocultos} ocultos`}
          />
        </div>
        <h3>Empleo</h3>
        <Barras datos={secciones.empleo.por_modalidad} etiquetas={ETIQUETAS.modalidad} vacio="Sin anuncios de empleo todavía." />
        <h3>Ofertas de trabajo</h3>
        <Barras datos={secciones.empleo.ofertas_por_estado} etiquetas={ETIQUETAS.estadoOferta} vacio="Sin ofertas todavía." />
        <h3>Recursos de turismo por sección</h3>
        <Barras datos={turismo} etiquetas={etiquetasTurismo} />
      </Bloque>
    </div>
  );
}

export default EstadisticasPanel;
