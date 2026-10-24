// Pleamares y bajamares a partir de una serie de nivel del mar (cada 15
// minutos). Open-Meteo no da las mareas como tabla, da la curva: aqui se
// buscan sus maximos y minimos locales.
//
// La serie llega en UTC a proposito (se pide con timezone=GMT): en hora local
// la noche del cambio de hora repite o se salta una hora, y la aritmetica de
// "15 minutos despues" fallaria justo ese dia.

// [{ instante: Date, valor: number }] -> [{ tipo, instante: Date, altura }]
export const extremosDeMarea = (serie) => {
  const extremos = [];

  for (let i = 1; i < serie.length - 1; i++) {
    const [a, b, c] = [serie[i - 1].valor, serie[i].valor, serie[i + 1].valor];
    if ([a, b, c].some((v) => typeof v !== 'number')) continue;

    // >= por un lado y > por el otro: en una meseta de dos puntos iguales se
    // cuenta un extremo, no dos.
    const esMaximo = b >= a && b > c;
    const esMinimo = b <= a && b < c;
    if (!esMaximo && !esMinimo) continue;

    // Ajuste parabolico con los tres puntos: el pico real casi nunca cae en
    // un multiplo exacto de 15 minutos. Desplazamiento en "pasos" (-0,5..0,5).
    const curvatura = a - 2 * b + c;
    const desplazamiento = curvatura === 0 ? 0 : (0.5 * (a - c)) / curvatura;
    const paso = serie[i + 1].instante - serie[i].instante;

    extremos.push({
      tipo: esMaximo ? 'pleamar' : 'bajamar',
      instante: new Date(serie[i].instante.getTime() + desplazamiento * paso),
      altura: Math.round((b - 0.25 * (a - c) * desplazamiento) * 100) / 100,
    });
  }

  return extremos;
};

// Valor de la serie mas cercano a un instante (para "el agua esta ahora a...").
export const valorMasCercano = (serie, instante = new Date()) => {
  let mejor = null;
  for (const punto of serie) {
    if (typeof punto.valor !== 'number') continue;
    if (!mejor || Math.abs(punto.instante - instante) < Math.abs(mejor.instante - instante)) mejor = punto;
  }
  return mejor?.valor ?? null;
};

// Open-Meteo: { time: ['2026-10-24T00:00', ...], <variable>: [...] } en UTC.
export const aSerie = (bloque, variable) =>
  (bloque?.time || []).map((t, i) => ({ instante: new Date(`${t}Z`), valor: bloque[variable]?.[i] }));
