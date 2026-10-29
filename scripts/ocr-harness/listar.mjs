// ============================================================================
// listar.mjs — arma el set de prueba desde la base (SOLO SELECT vía PostgREST)
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/ocr-harness/listar.mjs
//
// Filas de `inscripciones` del XIII y el XIV con comprobante, más `afiliaciones`
// con comprobante. Guarda `set.json` en HARNESS_DIR, deduplicado POR ARCHIVO:
// un comprobante puede cubrir varias filas (hermanos, dos días), y el harness
// lee imágenes, no filas. Cada archivo lleva sus filas con lo que la base
// guardó de la lectura vieja (`validacion_ocr.extracted`) para comparar.
//
// Por defecto, el set del 22-sep-2026 (XIII y XIV + todas las afiliaciones).
// Para un set nuevo (28-oct-2026, formatos nuevos de los bancos):
//   --concursos XVI-CDS-2026[,XVII-CDS-2026]   qué concursos
//   --desde 2026-09-01                          solo filas creadas desde esa fecha
//                                               (inscripciones y afiliaciones)
// ============================================================================
import path from 'node:path';
import { leerEnv, postgrestGet, rutas, escribirJson, ahora, args, sinSecretos } from './lib.mjs';
import { detectMediaType } from '../../supabase/functions/_shared/validacion-pagos.ts';

const CONCURSOS_DEFECTO = ['XIII-CDS-2026', 'XIV-CDS-2026'];
const romanoANum = (r) => {
  const v = { I: 1, V: 5, X: 10, L: 50 };
  let n = 0;
  for (let i = 0; i < r.length; i++) n += (v[r[i]] < (v[r[i + 1]] ?? 0) ? -1 : 1) * v[r[i]];
  return n;
};

const COLS_INS = 'id,nombre,concurso_id,estado,comprobante_url,nro_operacion,monto_pagado,monto_esperado,'
  + 'banco_origen,glosa,fecha_pago,titular_origen,cat_concurso,dias,equino,created_at,revisado_por,motivo_rechazo,validacion_ocr';
const COLS_AFI = 'id,nombre,temporada,estado,comprobante_url,nro_operacion,monto_pagado,monto_esperado,'
  + 'banco_origen,glosa,fecha_pago,titular_origen,created_at,revisado_por,motivo_rechazo,validacion_ocr';

async function main() {
  const a = args();
  const CONCURSOS = a.concursos ? String(a.concursos).split(',').map((x) => x.trim()).filter(Boolean) : CONCURSOS_DEFECTO;
  const ROMANOS = Object.fromEntries(CONCURSOS.map((c) => [c.split('-')[0], romanoANum(c.split('-')[0])]));
  const desde = a.desde ? `&created_at=gte.${encodeURIComponent(String(a.desde))}` : '';
  const env = leerEnv();
  const R = rutas();
  const log = (s) => console.log(sinSecretos(s));

  log(`Consultando ${new URL(env.NEXT_PUBLIC_SUPABASE_URL).host} (solo SELECT)…`);
  const [ins, afi, camps, cfg] = await Promise.all([
    postgrestGet(env, 'inscripciones',
      `select=${COLS_INS}&concurso_id=in.(${CONCURSOS.join(',')})&comprobante_url=not.is.null${desde}&order=created_at.asc`, { log }),
    postgrestGet(env, 'afiliaciones',
      `select=${COLS_AFI}&comprobante_url=not.is.null${desde}&order=created_at.asc`, { log }),
    postgrestGet(env, 'campeonatos',
      `select=numero,temporada,glosa_esperada,inscripciones_abiertas,cierre_ejecutado_en&temporada=eq.2026&numero=in.(${Object.values(ROMANOS).join(',')})`, { log }),
    postgrestGet(env, 'site_config', `select=key,value&key=eq.afiliacion_glosa_esperada`, { log }),
  ]);

  const glosas = {};
  for (const c of CONCURSOS) {
    const num = ROMANOS[c.split('-')[0]];
    const row = camps.find((r) => r.numero === num);
    if (!row?.glosa_esperada) throw new Error(`campeonatos sin glosa_esperada para ${c}`);
    glosas[c] = row.glosa_esperada;
  }
  const glosaAfilProd = cfg[0]?.value ?? null;   // la que usa la ruta automática de afiliaciones (fija)
  glosas.afiliacion_site_config = glosaAfilProd;

  // Glosa esperada por fila. Afiliaciones: por gestión ("Afiliacion ADESCRUZ 2025"),
  // como el modo «leer» del admin. La ruta automática de producción usa la de
  // site_config para todas — se guarda aparte para poder simular las dos.
  const filaComun = (r, tabla) => ({
    tabla,
    id: r.id,
    nombre: r.nombre,
    concurso_id: r.concurso_id ?? null,
    temporada: r.temporada ?? null,
    estado: r.estado,
    revisado_por_humano: !!r.revisado_por,
    created_at: r.created_at,
    comprobante_url: r.comprobante_url,
    nro_operacion: r.nro_operacion ?? null,
    monto_pagado: r.monto_pagado == null ? null : Number(r.monto_pagado),
    monto_esperado: r.monto_esperado == null ? null : Number(r.monto_esperado),
    banco_origen: r.banco_origen ?? null,
    glosa: r.glosa ?? null,
    fecha_pago: r.fecha_pago ?? null,
    titular_origen: r.titular_origen ?? null,
    motivo_rechazo: r.motivo_rechazo ?? null,
    cat_concurso: r.cat_concurso ?? null,
    dias: r.dias ?? null,
    glosa_esperada: tabla === 'inscripciones'
      ? glosas[r.concurso_id] ?? null
      : (glosaAfilProd ? glosaAfilProd.replace(/\d{4}/, String(r.temporada)) : `Afiliacion ADESCRUZ ${r.temporada}`),
    glosa_esperada_prod: tabla === 'inscripciones' ? glosas[r.concurso_id] ?? null : glosaAfilProd,
    ocr_viejo: r.validacion_ocr
      ? {
          extracted: r.validacion_ocr.extracted ?? null,
          validacion: r.validacion_ocr.validacion ?? null,
          error: r.validacion_ocr.error ?? null,
          ts: r.validacion_ocr.ts ?? null,
        }
      : null,
  });

  const porArchivo = new Map();
  const agregar = (fila) => {
    const k = fila.comprobante_url;
    if (!porArchivo.has(k)) {
      porArchivo.set(k, {
        archivo: k,
        tabla_ruta: k.split('/')[0],
        ext: path.extname(k).toLowerCase().replace('.', ''),
        media_type_prod: detectMediaType(k),
        filas: [],
      });
    }
    porArchivo.get(k).filas.push(fila);
  };
  for (const r of ins) agregar(filaComun(r, 'inscripciones'));
  for (const r of afi) agregar(filaComun(r, 'afiliaciones'));

  const archivos = [...porArchivo.values()];
  const filas = archivos.flatMap((x) => x.filas);
  const cuenta = (xs, f) => xs.reduce((m, x) => { const k = f(x) ?? '—'; m[k] = (m[k] || 0) + 1; return m; }, {});

  const resumen = {
    filas: filas.length,
    archivos_unicos: archivos.length,
    filas_por_tabla: cuenta(filas, (f) => f.tabla),
    filas_por_concurso: cuenta(filas, (f) => f.concurso_id ?? `afiliacion ${f.temporada}`),
    filas_por_estado: cuenta(filas, (f) => f.estado),
    archivos_por_ext: cuenta(archivos, (x) => x.ext),
    filas_con_lectura_vieja: filas.filter((f) => f.ocr_viejo?.extracted).length,
    filas_con_error_ocr_viejo: filas.filter((f) => f.ocr_viejo?.error).length,
    filas_revisadas_por_humano: filas.filter((f) => f.revisado_por_humano).length,
    archivos_con_varias_filas: archivos.filter((x) => x.filas.length > 1).length,
  };

  const set = {
    generado: ahora(),
    fuente: { host: new URL(env.NEXT_PUBLIC_SUPABASE_URL).host, concursos: CONCURSOS, desde: a.desde ?? null, afiliaciones: a.desde ? `con comprobante, desde ${a.desde}` : 'todas con comprobante' },
    glosas,
    resumen,
    archivos,
  };
  escribirJson(R.set, set);
  log(`\nset.json → ${R.set}`);
  log(JSON.stringify(resumen, null, 1));
  if (a.verboso) for (const x of archivos) log(`  ${x.archivo}  (${x.filas.length} fila/s)`);
}

main().catch((e) => { console.error('ERROR listar:', sinSecretos(e.message)); process.exit(1); });
