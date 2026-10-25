import LineaAutobus from '../models/LineaAutobus.js';
import { ahoraEnMadrid } from '../utils/guardiaFarmacia.js';
import { proximasSalidas, tipoDeDia } from '../utils/horarioAutobus.js';

// Las lineas con sus horarios completos y, ya calculadas, las proximas
// salidas de cada sentido. Se calculan aqui y no en el navegador porque la
// hora que manda es la de Lepe, no la del movil de quien mira (un turista con
// el reloj de su pais veria salidas equivocadas).
export const listarLineas = async (req, res, next) => {
  try {
    const ahora = ahoraEnMadrid();
    const lineas = await LineaAutobus.find({ activa: true }).sort({ orden: 1, nombre: 1 }).lean();

    res.json({
      ok: true,
      ahora,
      tipo_dia: tipoDeDia(ahora.dia),
      lineas: lineas.map(({ __v, ...linea }) => ({
        ...linea,
        sentidos: linea.sentidos.map((s) => ({ ...s, proximas: proximasSalidas(s.horarios, { ahora }) })),
      })),
    });
  } catch (error) {
    next(error);
  }
};
