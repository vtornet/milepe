import ErrorHttp from './ErrorHttp.js';

// Reparto del trabajo de moderación entre varias personas: un moderador "se
// queda" un reporte (o un admin una apelación) para que otro no lo esté
// revisando a la vez y acaben resolviéndolo dos veces o en sentidos
// opuestos.
//
// La asignación caduca sola (`asignado_hasta`, el patrón de siempre: "vale
// mientras la fecha esté en el futuro"). Si quien la tomó se va de
// vacaciones, el reporte vuelve a estar libre al día siguiente sin que
// nadie tenga que acordarse de soltarlo.
export const HORAS_ASIGNACION = 24;

// Campos que llevan Reporte y Apelacion.
export const camposAsignacion = (Schema) => ({
  asignado_a: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
  asignado_hasta: { type: Date, default: null },
});

const idDe = (valor) => String(valor?._id || valor);

export const estaAsignadoAOtro = (doc, usuario, ahora = new Date()) =>
  Boolean(doc.asignado_a && doc.asignado_hasta > ahora && idDe(doc.asignado_a) !== String(usuario._id));

// Lo que se exige antes de resolver: o está libre, o es tuyo.
export const exigirLibreOMio = (doc, usuario) => {
  if (estaAsignadoAOtro(doc, usuario)) {
    throw new ErrorHttp(409, 'Lo está revisando otra persona del equipo; espera a que lo suelte o a que caduque');
  }
};

// Tomar es atómico: dos moderadores que pulsan a la vez no se lo quedan los
// dos. Tomar lo que ya es tuyo renueva el plazo.
export const tomar = async (Modelo, id, usuario) => {
  const ahora = new Date();
  const hasta = new Date(ahora.getTime() + HORAS_ASIGNACION * 60 * 60 * 1000);
  const doc = await Modelo.findOneAndUpdate(
    {
      _id: id,
      estado: 'pendiente',
      $or: [{ asignado_a: null }, { asignado_hasta: { $lte: ahora } }, { asignado_a: usuario._id }],
    },
    { $set: { asignado_a: usuario._id, asignado_hasta: hasta } },
    { new: true },
  );
  if (doc) return doc;

  const actual = await Modelo.findById(id);
  if (!actual) throw new ErrorHttp(404, 'No encontrado');
  if (actual.estado !== 'pendiente') throw new ErrorHttp(409, 'Ya está resuelto');
  throw new ErrorHttp(409, 'Ya lo está revisando otra persona del equipo');
};

// Soltar: quien lo tiene, o un admin (para liberar lo que alguien dejó
// cogido). Soltar lo que ya está libre no es un error.
export const soltar = async (Modelo, id, usuario) => {
  const doc = await Modelo.findById(id);
  if (!doc) throw new ErrorHttp(404, 'No encontrado');
  if (estaAsignadoAOtro(doc, usuario) && usuario.rol !== 'admin') {
    throw new ErrorHttp(403, 'Solo puede soltarlo quien lo tiene, o un administrador');
  }
  doc.asignado_a = null;
  doc.asignado_hasta = null;
  await doc.save();
  return doc;
};

// Filtro de la cola: ?asignacion=mias | libres (sin parámetro, todo).
export const filtroAsignacion = (valor, usuario, ahora = new Date()) => {
  if (valor === 'mias') return { asignado_a: usuario._id, asignado_hasta: { $gt: ahora } };
  if (valor === 'libres') return { $or: [{ asignado_a: null }, { asignado_hasta: { $lte: ahora } }] };
  if (valor === undefined || valor === '' || valor === 'todas') return {};
  throw new ErrorHttp(400, "asignacion debe ser 'mias', 'libres' o 'todas'");
};
