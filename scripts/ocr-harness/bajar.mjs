// ============================================================================
// bajar.mjs — baja cada comprobante del set desde el bucket privado (SOLO GET)
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/ocr-harness/bajar.mjs [--rehacer] [--conc 3]
//
// Guarda los originales en HARNESS_DIR/orig/ con el nombre aplanado
// ("inscripciones/123_Ana.png" → "inscripciones__123_Ana.png") y escribe
// bajados.json con tamaño y sha256 de cada uno. Si el archivo ya está (mismo
// nombre, tamaño > 0) no se vuelve a bajar, salvo --rehacer: la red se cayó
// una vez en medio de esto y no hace falta empezar de cero.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { leerEnv, storageGet, rutas, leerJson, escribirJson, nombreLocal, sha256, enParalelo, args, sinSecretos, ms } from './lib.mjs';

const BUCKET = 'comprobantes';

async function main() {
  const a = args();
  const env = leerEnv();
  const R = rutas();
  const log = (s) => console.log(sinSecretos(s));
  const set = leerJson(R.set);
  const previo = leerJson(R.bajados, {});
  const conc = Number(a.conc || 3);
  const t0 = performance.now();
  let bajados = 0, reutilizados = 0, fallidos = 0;

  const res = await enParalelo(set.archivos, conc, async (x, i) => {
    const local = path.join(R.orig, nombreLocal(x.archivo));
    const tag = `[${String(i + 1).padStart(3)}/${set.archivos.length}] ${path.basename(x.archivo)}`;
    if (!a.rehacer && fs.existsSync(local) && fs.statSync(local).size > 0) {
      reutilizados++;
      const buf = fs.readFileSync(local);
      return [x.archivo, { local: path.basename(local), bytes: buf.length, sha256: sha256(buf), reutilizado: true }];
    }
    try {
      const t = performance.now();
      const buf = await storageGet(env, BUCKET, x.archivo, { log });
      fs.writeFileSync(local, buf);
      bajados++;
      log(`${tag}  ${(buf.length / 1024).toFixed(0)} KB en ${ms(t)} ms`);
      return [x.archivo, { local: path.basename(local), bytes: buf.length, sha256: sha256(buf), reutilizado: false }];
    } catch (e) {
      fallidos++;
      log(`${tag}  FALLÓ: ${e.message}`);
      return [x.archivo, { local: null, error: e.message }];
    }
  });

  const salida = { ...previo };
  for (const [k, v] of res) salida[k] = v;
  escribirJson(R.bajados, salida);

  // Archivos idénticos con nombres distintos (un pago que cubre varias filas,
  // o el mismo comprobante subido dos veces). Solo se informa.
  const porHash = {};
  for (const [k, v] of Object.entries(salida)) if (v.sha256) (porHash[v.sha256] ||= []).push(k);
  const duplicados = Object.values(porHash).filter((g) => g.length > 1);

  log(`\nbajados ${bajados}, reutilizados ${reutilizados}, fallidos ${fallidos}, en ${Math.round(ms(t0) / 1000)} s → ${R.orig}`);
  log(`total en disco: ${(Object.values(salida).reduce((s, v) => s + (v.bytes || 0), 0) / 1024 / 1024).toFixed(1)} MB`);
  log(`grupos de archivos idénticos (sha256): ${duplicados.length}` + duplicados.map((g) => `\n   · ${g.map((p) => path.basename(p)).join('  =  ')}`).join(''));
  if (fallidos) process.exit(2);
}

main().catch((e) => { console.error('ERROR bajar:', sinSecretos(e.message)); process.exit(1); });
