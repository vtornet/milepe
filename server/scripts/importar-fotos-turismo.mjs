// Pone fotos a las fichas de Turismo con imagenes de Wikimedia Commons de
// licencia libre (CC BY, CC BY-SA o dominio publico), que exigen citar al
// autor: por eso cada imagen guarda su credito (autor, licencia y pagina
// de origen) en `creditos`, y el cliente lo muestra bajo la foto.
//
// Las imagenes y sus datos estan elegidos a mano en datos/fotos-turismo.json
// (una busqueda automatica trae fotos de otros sitios). Solo cubre los
// lugares que tienen una foto libre buena; el resto queda sin foto.
//
// Cada imagen se descarga de Commons a 2000 px de ancho maximo y se sube
// a Cloudinary (carpeta milepe/turismo): las fotos viven en nuestro
// Cloudinary, no se enlazan desde Commons.
//
// Idempotente: una ficha que ya tiene imagenes se salta, asi que no pisa
// las que haya subido un admin ni duplica en una segunda ejecucion.
//
// Uso: node scripts/importar-fotos-turismo.mjs
import 'dotenv/config';
import fs from 'node:fs';
import mongoose from 'mongoose';
import conectarDB from '../src/config/db.js';
import RecursoTuristico from '../src/models/RecursoTuristico.js';
import subirImagen from '../src/utils/subirImagen.js';

const FOTOS = JSON.parse(fs.readFileSync(new URL('./datos/fotos-turismo.json', import.meta.url), 'utf8'));
// Wikimedia pide identificarse en el User-Agent y rechaza los anonimos.
const CABECERAS = { 'User-Agent': 'MiLepe-importador/1.0 (https://milepe.com; contact@appstracta.app)' };

const descargar = async (archivo) => {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(archivo)}?width=2000`;
  const respuesta = await fetch(url, { headers: CABECERAS });
  if (!respuesta.ok) throw new Error(`Commons respondio ${respuesta.status} para "${archivo}"`);
  return Buffer.from(await respuesta.arrayBuffer());
};

const importar = async () => {
  await conectarDB();

  let fichas = 0;
  let imagenes = 0;
  const sinFicha = [];

  for (const [titulo, fotos] of Object.entries(FOTOS)) {
    const recurso = await RecursoTuristico.findOne({ titulo });
    if (!recurso) {
      sinFicha.push(titulo);
      continue;
    }
    if (recurso.imagenes.length > 0) {
      console.log(`[fotos] ${titulo}: ya tiene imagenes, se salta`);
      continue;
    }

    const urls = [];
    const creditos = [];
    for (const foto of fotos) {
      const subida = await subirImagen(await descargar(foto.archivo), { carpeta: 'milepe/turismo' });
      urls.push(subida.secure_url);
      creditos.push({ imagen: subida.secure_url, autor: foto.autor, licencia: foto.licencia, url: foto.pagina });
    }

    recurso.imagenes = urls;
    recurso.creditos = creditos;
    await recurso.save();

    fichas += 1;
    imagenes += urls.length;
    console.log(`[fotos] ${titulo}: ${urls.length} imagen(es)`);
  }

  console.log(`[fotos] ${imagenes} imagen(es) en ${fichas} ficha(s).`);
  if (sinFicha.length) console.log(`[fotos] Sin ficha con ese titulo: ${sinFicha.join(', ')}`);

  await mongoose.disconnect();
};

importar().catch(async (error) => {
  console.error('[fotos] Error:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
