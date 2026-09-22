// ============================================================================
// leer.mjs — lee cada comprobante del set con el modelo, con el prompt que se pida
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/ocr-harness/leer.mjs \
//        --prompt actual|prompts/mi-variante.txt  --set comp|orig  --rep 1 \
//        [--out lecturas_x.json] [--conc 3] [--temperature 0] [--solo Ana] [--limite 5] [--rehacer]
//
// «actual» importa PROMPT_OCR del módulo compartido de las Edge Functions, así
// que mide EXACTAMENTE producción. Para probar variantes, el prompt viene de un
// .txt: el modelo, max_tokens y el formato del pedido son los de
// callClaudeVision(), replicados acá porque esa función tiene el prompt fijo.
//
// A la salida del modelo se le aplica lo mismo que hace la función real:
// parseFechaPago() (hora impresa = Bolivia) y normalizarNroOperacion() (guard).
//
// Es REANUDABLE: si el archivo de salida ya tiene una lectura buena de una
// imagen, no la vuelve a pedir (una corrida cuesta plata; la red se cae). Con
// --rehacer se ignora lo que había.
//
// Presupuesto: cada llamada gasta ~2.000-2.500 tokens de entrada (imagen ≈ 1.500,
// prompt ≈ 800) y ~300 de salida. Se estima el costo con los precios de abajo.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  leerEnv, rutas, leerJson, escribirJson, nombreLocal, fetchConReintento, enParalelo,
  args, sinSecretos, ahora, ms, MODULO_COMPARTIDO,
} from './lib.mjs';
import { PROMPT_OCR, parseFechaPago, normalizarNroOperacion, detectMediaType } from '../../supabase/functions/_shared/validacion-pagos.ts';

// Réplica de las constantes privadas de _shared/validacion-pagos.ts. Si allá
// cambian, `verificarConstantes()` avisa (no se puede importar lo que no se exporta).
const CLAUDE_MODEL = 'claude-sonnet-4-5';
const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS = 1024;
// USD por millón de tokens. ⚠️ A VERIFICAR contra la página de precios: el
// skill de referencia no lista Sonnet 4.5 (sí Sonnet 4.6 a 3/15).
const PRECIOS_USD_POR_MTOK = { 'claude-sonnet-4-5': { input: 3, output: 15 } };

function verificarConstantes(log) {
  const src = fs.readFileSync(MODULO_COMPARTIDO, 'utf8');
  const modelo = src.match(/const CLAUDE_MODEL\s*=\s*'([^']+)'/)?.[1];
  const api = src.match(/const CLAUDE_API\s*=\s*'([^']+)'/)?.[1];
  const maxTok = Number(src.match(/max_tokens:\s*(\d+)/)?.[1]);
  const avisos = [];
  if (modelo !== CLAUDE_MODEL) avisos.push(`modelo: producción '${modelo}' ≠ harness '${CLAUDE_MODEL}'`);
  if (api !== CLAUDE_API) avisos.push(`endpoint: producción '${api}' ≠ harness '${CLAUDE_API}'`);
  if (maxTok !== MAX_TOKENS) avisos.push(`max_tokens: producción ${maxTok} ≠ harness ${MAX_TOKENS}`);
  for (const s of avisos) log(`⚠️  ${s} — el harness ya no replica producción`);
  return avisos;
}

// Réplica de callClaudeVision() con el prompt como parámetro (y temperature opcional).
export async function leerConPrompt(base64, mediaType, prompt, { apiKey, temperature, log = null } = {}) {
  const body = {
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{
      role: 'user',
      content: [
        mediaType === 'application/pdf'
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
          : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: prompt },
      ],
    }],
  };
  if (typeof temperature === 'number') body.temperature = temperature;

  const t0 = performance.now();
  const res = await fetchConReintento(CLAUDE_API, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, { intentos: 6, baseMs: 3000, log });
  const latencia_ms = ms(t0);
  if (!res.ok) {
    const txt = sinSecretos(await res.text());
    throw Object.assign(new Error(`Claude API ${res.status}: ${txt.slice(0, 300)}`), { status: res.status, latencia_ms });
  }
  const json = await res.json();
  const text = json?.content?.[0]?.text;
  const base = { usage: json.usage ?? null, stop_reason: json.stop_reason ?? null, modelo: json.model ?? null, latencia_ms };
  if (!text) throw Object.assign(new Error('Claude returned no text content'), base);
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return { ...base, extracted: JSON.parse(cleaned) }; }
  catch { throw Object.assign(new Error(`Claude returned non-JSON: ${cleaned.slice(0, 200)}`), { ...base, crudo: cleaned.slice(0, 500) }); }
}

function cargarPrompt(spec) {
  if (!spec || spec === 'actual') {
    return { nombre: 'actual', origen: 'PROMPT_OCR de ' + path.relative(process.cwd(), MODULO_COMPARTIDO), texto: PROMPT_OCR };
  }
  if (!fs.existsSync(spec)) throw new Error(`No existe el prompt ${spec}`);
  return { nombre: path.basename(spec).replace(/\.[^.]+$/, ''), origen: spec, texto: fs.readFileSync(spec, 'utf8') };
}

async function main() {
  const a = args();
  const env = leerEnv();
  const R = rutas();
  const log = (s) => console.log(sinSecretos(s));
  const set = leerJson(R.set);
  const prompt = cargarPrompt(a.prompt);
  const cual = a.set || 'comp';
  const rep = Math.max(1, Number(a.rep || 1));
  const conc = Math.min(3, Math.max(1, Number(a.conc || 3)));   // ≤3 por regla de la casa
  const temperature = a.temperature !== undefined ? Number(a.temperature) : undefined;
  const salida = a.out || path.join(R.dir, `lecturas_${prompt.nombre}${cual === 'orig' ? '_orig' : ''}.json`);
  const precios = PRECIOS_USD_POR_MTOK[CLAUDE_MODEL];

  const avisos = verificarConstantes(log);

  // Dónde está cada archivo en disco según el set (comprimido u original).
  const bajados = leerJson(R.bajados, {});
  const comprimidos = cual === 'comp' ? leerJson(R.comprimidos).archivos : null;
  const localDe = (archivo) => {
    const nl = nombreLocal(archivo);
    if (cual === 'orig') return bajados[archivo]?.local ? path.join(R.orig, bajados[archivo].local) : null;
    const c = comprimidos[nl];
    return c?.comp ? path.join(R.comp, c.comp) : null;
  };

  let items = set.archivos;
  if (a.solo) items = items.filter((x) => x.archivo.toLowerCase().includes(String(a.solo).toLowerCase()));
  if (a.limite) items = items.slice(0, Number(a.limite));

  const previo = !a.rehacer && fs.existsSync(salida) ? leerJson(salida) : null;
  const out = {
    meta: {
      prompt: { nombre: prompt.nombre, origen: prompt.origen, sha256: crypto.createHash('sha256').update(prompt.texto).digest('hex'), chars: prompt.texto.length },
      modelo: CLAUDE_MODEL, max_tokens: MAX_TOKENS, temperature: temperature ?? null,
      set: cual, set_dir: cual === 'orig' ? R.orig : R.comp, rep, concurrencia: conc,
      inicio: previo?.meta?.inicio ?? ahora(), fin: null,
      llamadas: previo?.meta?.llamadas ?? 0, tokens: previo?.meta?.tokens ?? { input: 0, output: 0 },
      costo_usd_estimado: 0, precios_usd_por_mtok: precios, errores: 0, avisos_constantes: avisos,
    },
    lecturas: previo?.lecturas ?? {},
  };

  // Cuántas llamadas hacen falta (reanudación): solo las reps que faltan.
  const pendientes = [];
  for (const x of items) {
    const buenas = (out.lecturas[x.archivo]?.reps ?? []).filter((r) => r.extracted && !r.error).length;
    for (let k = buenas; k < rep; k++) pendientes.push(x);
  }
  const tope = a['max-llamadas'] ? Number(a['max-llamadas']) : items.length * rep;
  if (pendientes.length > tope) throw new Error(`Harían falta ${pendientes.length} llamadas y el tope es ${tope} (--max-llamadas).`);
  log(`prompt «${prompt.nombre}» (${prompt.texto.length} chars) · modelo ${CLAUDE_MODEL} · set ${cual} · rep ${rep} · ${items.length} archivos · ${pendientes.length} llamadas pendientes`
    + (temperature !== undefined ? ` · temperature ${temperature}` : '') + `\nsalida → ${salida}`);
  if (!pendientes.length) { log('Nada pendiente.'); return; }

  const guardar = () => {
    out.meta.costo_usd_estimado = +((out.meta.tokens.input * precios.input + out.meta.tokens.output * precios.output) / 1e6).toFixed(4);
    out.meta.errores = Object.values(out.lecturas).reduce((s, l) => s + l.reps.filter((r) => r.error).length, 0);
    escribirJson(salida, out);
  };

  const t0 = performance.now();
  let hechas = 0;
  await enParalelo(pendientes, conc, async (x) => {
    const local = localDe(x.archivo);
    const tag = `[${String(++hechas).padStart(3)}/${pendientes.length}] ${path.basename(x.archivo).slice(0, 50)}`;
    const entrada = (out.lecturas[x.archivo] ||= { local: local ? path.basename(local) : null, media_type: null, bytes: null, reps: [] });
    // Una lectura con error se reemplaza por la nueva (no se acumulan errores).
    entrada.reps = entrada.reps.filter((r) => !r.error);
    if (!local || !fs.existsSync(local)) {
      entrada.reps.push({ error: `no está en disco (${cual}): corré bajar.mjs / comprimir.py`, ts: ahora() });
      log(`${tag}  SIN ARCHIVO`); guardar(); return;
    }
    const buf = fs.readFileSync(local);
    const mediaType = detectMediaType(path.basename(local));
    entrada.media_type = mediaType; entrada.bytes = buf.length;
    try {
      const r = await leerConPrompt(buf.toString('base64'), mediaType, prompt.texto, { apiKey: env.ANTHROPIC_API_KEY, temperature, log });
      const ex = r.extracted;
      entrada.reps.push({
        extracted: ex,
        nro_normalizado: normalizarNroOperacion(ex?.nro_operacion),
        fecha_iso: parseFechaPago(ex?.fecha_pago),
        usage: r.usage, stop_reason: r.stop_reason, modelo: r.modelo, latencia_ms: r.latencia_ms, ts: ahora(),
      });
      out.meta.llamadas++;
      out.meta.tokens.input += r.usage?.input_tokens ?? 0;
      out.meta.tokens.output += r.usage?.output_tokens ?? 0;
      log(`${tag}  ok ${(r.latencia_ms / 1000).toFixed(1)} s · in ${r.usage?.input_tokens ?? '?'} · out ${r.usage?.output_tokens ?? '?'}${r.stop_reason !== 'end_turn' ? ` · stop=${r.stop_reason}` : ''}`);
    } catch (e) {
      // Un 4xx que no sea 429 también gastó (o no) — se registra como en producción: «Error OCR».
      if (e.usage) { out.meta.llamadas++; out.meta.tokens.input += e.usage.input_tokens ?? 0; out.meta.tokens.output += e.usage.output_tokens ?? 0; }
      entrada.reps.push({ error: sinSecretos(e.message), crudo: e.crudo ?? null, status: e.status ?? null, latencia_ms: e.latencia_ms ?? null, ts: ahora() });
      log(`${tag}  ERROR ${sinSecretos(e.message).slice(0, 160)}`);
    }
    guardar();
  });

  out.meta.fin = ahora();
  guardar();
  const m = out.meta;
  log(`\n${pendientes.length} llamadas en ${Math.round(ms(t0) / 1000)} s · acumulado: ${m.llamadas} llamadas, tokens in ${m.tokens.input} / out ${m.tokens.output}, ≈ US$ ${m.costo_usd_estimado} · errores ${m.errores}\n→ ${salida}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('leer.mjs')) {
  main().catch((e) => { console.error('ERROR leer:', sinSecretos(e.message)); process.exit(1); });
}
