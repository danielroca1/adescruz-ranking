// ============================================================================
// scripts/ocr-harness/lib.mjs — utilidades compartidas del harness
//
// Reglas de la casa:
//   · SOLO LECTURA sobre Supabase (PostgREST GET y Storage GET). Acá no hay
//     ninguna función que escriba, y no se agrega ninguna.
//   · Los secretos se leen de `adescruz-app/.env.local` y NUNCA se imprimen.
//     `sinSecretos()` tapa cualquier valor de secreto que se cuele en un error.
//   · Sin dependencias: Node ≥ 22.18 tiene fetch nativo y quita los tipos de
//     los `.ts` al importarlos (el módulo compartido se importa tal cual).
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(AQUI, '..', '..');             // adescruz-app/
export const MODULO_COMPARTIDO = path.join(REPO, 'supabase', 'functions', '_shared', 'validacion-pagos.ts');

// Carpeta de trabajo (imágenes bajadas, comprimidas, lecturas, informes).
// NO va dentro del repo: por defecto el tmp del sistema; en las sesiones de
// Cowork se apunta con HARNESS_DIR al scratchpad de la sesión.
export function dirTrabajo() {
  const d = process.env.HARNESS_DIR || path.join(os.tmpdir(), 'adescruz-ocr-harness');
  fs.mkdirSync(d, { recursive: true });
  return d;
}
export function rutas(dir = dirTrabajo()) {
  const r = {
    dir,
    orig: path.join(dir, 'orig'),
    comp: path.join(dir, 'comp'),
    set: path.join(dir, 'set.json'),
    bajados: path.join(dir, 'bajados.json'),
    comprimidos: path.join(dir, 'comprimidos.json'),
  };
  fs.mkdirSync(r.orig, { recursive: true });
  fs.mkdirSync(r.comp, { recursive: true });
  return r;
}

// ─── Secretos ───────────────────────────────────────────────────────────────
const REQUERIDAS = ['ANTHROPIC_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL'];
let _env = null;
export function leerEnv({ requerir = REQUERIDAS } = {}) {
  if (_env) return _env;
  const archivo = path.join(REPO, '.env.local');
  if (!fs.existsSync(archivo)) {
    throw new Error(`Falta ${archivo}. Tiene que tener: ${REQUERIDAS.join(', ')}.`);
  }
  const env = {};
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  const faltan = requerir.filter((k) => !env[k]);
  if (faltan.length) {
    throw new Error(`En .env.local faltan (o están vacías): ${faltan.join(', ')}. No se imprime ningún valor.`);
  }
  _env = env;
  return env;
}
// Tapa los valores de los secretos en cualquier texto (mensajes de error, cuerpos de respuesta).
export function sinSecretos(texto) {
  let s = String(texto ?? '');
  if (!_env) return s;
  for (const k of REQUERIDAS) {
    const v = _env[k];
    if (v && v.length >= 8) s = s.split(v).join(`<${k}>`);
  }
  return s;
}

// ─── fetch con reintentos ───────────────────────────────────────────────────
// Reintenta ante error de red (ECONNRESET, ENOTFOUND, timeout) y ante 408/425/
// 429/500/502/503/504/529. Respeta `retry-after` si viene. Backoff exponencial
// con tope. Devuelve la Response (aunque sea 4xx no reintentable): decide el
// que llama.
export async function fetchConReintento(url, opts = {}, {
  intentos = 5, baseMs = 1500, topeMs = 30000, timeoutMs = 120000, log = null,
} = {}) {
  const REINTENTABLES = new Set([408, 425, 429, 500, 502, 503, 504, 529]);
  let ultimoError = null;
  for (let i = 0; i < intentos; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(new Error(`timeout ${timeoutMs} ms`)), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      clearTimeout(t);
      if (!REINTENTABLES.has(res.status) || i === intentos - 1) return res;
      const ra = Number(res.headers.get('retry-after'));
      const espera = Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(topeMs, baseMs * 2 ** i);
      log?.(`  HTTP ${res.status}, reintento ${i + 1}/${intentos - 1} en ${Math.round(espera / 1000)} s`);
      await res.text().catch(() => {});      // liberar el cuerpo
      await dormir(espera);
    } catch (e) {
      clearTimeout(t);
      ultimoError = e;
      if (i === intentos - 1) break;
      const espera = Math.min(topeMs, baseMs * 2 ** i);
      log?.(`  red: ${e?.cause?.code || e?.name || e?.message}, reintento ${i + 1}/${intentos - 1} en ${Math.round(espera / 1000)} s`);
      await dormir(espera);
    }
  }
  throw new Error(`Sin red tras ${intentos} intentos: ${sinSecretos(ultimoError?.cause?.code || ultimoError?.message || ultimoError)}`);
}
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── PostgREST (solo GET) ───────────────────────────────────────────────────
// La clave de servicio rechaza User-Agents de navegador: se manda uno propio.
export function headersSupabase(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'User-Agent': 'adescruz-harness',
  };
}
export async function postgrestGet(env, tabla, query, { log = null } = {}) {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${tabla}?${query}`;
  const filas = [];
  const PAGINA = 1000;
  for (let desde = 0; ; desde += PAGINA) {
    const res = await fetchConReintento(url, {
      headers: { ...headersSupabase(env), Accept: 'application/json', Range: `${desde}-${desde + PAGINA - 1}`, Prefer: 'count=exact' },
    }, { log });
    if (!(res.status === 200 || res.status === 206)) {
      throw new Error(`PostgREST ${tabla} → HTTP ${res.status}: ${sinSecretos(await res.text()).slice(0, 300)}`);
    }
    const lote = await res.json();
    filas.push(...lote);
    const total = Number((res.headers.get('content-range') || '').split('/')[1]);
    if (lote.length < PAGINA || (Number.isFinite(total) && filas.length >= total)) break;
  }
  return filas;
}

// ─── Storage (solo GET del bucket privado) ──────────────────────────────────
export async function storageGet(env, bucket, ruta, { log = null } = {}) {
  const codificada = ruta.split('/').map(encodeURIComponent).join('/');
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${codificada}`;
  const res = await fetchConReintento(url, { headers: headersSupabase(env) }, { log, timeoutMs: 180000 });
  if (res.status !== 200) {
    throw new Error(`Storage ${bucket}/${ruta} → HTTP ${res.status}: ${sinSecretos(await res.text()).slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ─── Varios ─────────────────────────────────────────────────────────────────
export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
export function leerJson(p, porDefecto = undefined) {
  if (!fs.existsSync(p)) {
    if (porDefecto !== undefined) return porDefecto;
    throw new Error(`No existe ${p}`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
export function escribirJson(p, obj) {
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 1));
  fs.renameSync(tmp, p);
}
// Nombre local de un archivo del bucket: "inscripciones/123_Ana.png" → "inscripciones__123_Ana.png"
export const nombreLocal = (rutaBucket) => rutaBucket.replace(/\//g, '__');

// Argumentos "--clave valor" y "--flag".
export function args(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const sig = argv[i + 1];
      if (sig !== undefined && !sig.startsWith('--')) { out[k] = sig; i++; } else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

// Corre `fn(item, i)` sobre `items` con a lo sumo `n` en paralelo, en orden de arranque.
export async function enParalelo(items, n, fn) {
  const resultados = new Array(items.length);
  let i = 0;
  async function obrero() {
    while (i < items.length) {
      const idx = i++;
      resultados[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, obrero));
  return resultados;
}

export const ahora = () => new Date().toISOString();
export const ms = (t0) => Math.round(performance.now() - t0);
