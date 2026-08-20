// ============================================================
// Edge Function: validar-comprobante-afiliacion
// Recibe { afiliacion_id }, baja el comprobante, lo manda a
// Claude Vision, valida contra reglas de pago, actualiza
// la afiliación con el resultado.
//
// Diferencia clave vs `validar-comprobante` (inscripciones):
//  - Carga tarifas_afiliacion + afiliacion_caballos para calcular monto esperado
//  - Glosa esperada de site_config.afiliacion_glosa_esperada (no per-CDS)
//  - Anti-reuso CROSS-TABLE: chequea afiliaciones.nro_operacion E inscripciones.nro_operacion
//
// Secrets requeridos (Supabase Dashboard → Functions → Secrets):
//   ANTHROPIC_API_KEY     — sk-ant-api03-...
//   SUPABASE_URL          — auto-provisto por Supabase
//   SUPABASE_SERVICE_ROLE_KEY — auto-provisto por Supabase
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// ─── Config ────────────────────────────────────────────────────
const CLAUDE_MODEL = 'claude-sonnet-4-5';
const CLAUDE_API   = 'https://api.anthropic.com/v1/messages';

// Reglas de pago duras (datos del beneficiario ADESCRUZ — los mismos que inscripciones)
const VALIDACION = {
  cuenta_destino: '2000274154',
  titular_destino_re: /bedoya\s+alipaz\s+nicol/i,
  // Acepta: "Banco Nacional", "Banco Nacional de Bolivia", "BNB", "B.N.B.", "B N B"
  banco_destino_re:   /banco\s*nacional(?:\s+de\s+bolivia)?|\bb\.?\s*n\.?\s*b\.?\b/i,
  ventana_dias_atras: 60,
};

// Tarifas dinámicas — leídas de tabla tarifas_afiliacion
type TarifasAfil = {
  costo_jinete: number;
  costo_caballo: number;
};
const TARIFAS_FALLBACK: TarifasAfil = { costo_jinete: 500, costo_caballo: 210 };

// CORS para llamados desde el browser
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Prompt para Claude Vision (idéntico al de inscripciones) ──
const PROMPT_OCR = `You are an OCR specialist analyzing a Bolivian bank transfer receipt (comprobante de pago bancario).

Extract these fields and return ONLY a single valid JSON object — no markdown, no commentary, no code fences.

Required JSON shape:
{
  "banco_origen": string|null,
  "titular_origen": string|null,
  "monto": number|null,
  "moneda": "BOB"|"USD"|null,
  "fecha_pago": string|null,
  "nro_operacion": string|null,
  "cuenta_destino": string|null,
  "titular_destino": string|null,
  "banco_destino": string|null,
  "glosa": string|null,
  "tipo_transaccion": string|null,
  "confianza": number,
  "notas": string|null
}

Rules:
- If a field is unclear or absent, use null. Do NOT invent data.
- DATES ARE BOLIVIAN: numeric dates are DAY/MONTH/YEAR (DD/MM/YYYY). Example: "01/06/2026" means 1 June 2026, NOT January 6. Output "fecha_pago" as ISO 8601 (YYYY-MM-DDTHH:MM:SS) with the day and month in the CORRECT positions.
- "monto" is the AMOUNT TRANSFERRED (not balance, not commission). Look for "monto", "importe", "total", "Bs."
- Bolivian receipts often show "operación N°" or "número de operación" or "referencia" — that's "nro_operacion".
- For QR payments, "banco_destino" may be inferred from the recipient's account prefix or QR provider.
- If you cannot find ANY of the fields (image is not a receipt), set "confianza": 0 and "notas": "Not a bank receipt".`;

// ─── Helpers ──────────────────────────────────────────────────
function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function callClaudeVision(imageBase64: string, mediaType: string, apiKey: string) {
  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          // PDF se manda como bloque 'document'; imágenes como 'image'. (Claude rechaza un PDF dentro de 'image'.)
          mediaType === 'application/pdf'
            ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: imageBase64 } }
            : { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: PROMPT_OCR },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Claude API ${res.status}: ${txt}`);
  }
  const json = await res.json();
  const text = json?.content?.[0]?.text;
  if (!text) throw new Error('Claude returned no text content');
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); }
  catch { throw new Error(`Claude returned non-JSON: ${cleaned.slice(0, 200)}`); }
}

function detectMediaType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'png')  return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif')  return 'image/gif';
  if (ext === 'pdf')  return 'application/pdf';
  return 'image/jpeg';
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Normaliza una fecha que Claude pudo haber devuelto en español ("28 de Abril, 2026 a las 20:39")
// o en ISO. Devuelve ISO 8601 string o null si no se puede parsear.
function parseFechaPago(s: string | null | undefined): string | null {
  if (!s || typeof s !== 'string') return null;
  const trimmed = s.trim();

  // Intento 0: ISO 8601 explícito (YYYY-MM-DD...). No es ambiguo → parse directo.
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const iso = new Date(trimmed);
    if (!isNaN(iso.getTime())) return iso.toISOString();
  }

  // Intento 1: formato boliviano numérico DD/MM/YYYY o DD-MM-YYYY (DÍA PRIMERO), con hora opcional.
  // OJO: new Date("01/06/2026") en JS asume MM/DD (gringo) y da 6-ene. Por eso parseamos a mano.
  const mNum = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[\sT,]+(\d{1,2}):(\d{2}))?/);
  if (mNum) {
    let day = parseInt(mNum[1], 10), month = parseInt(mNum[2], 10), year = parseInt(mNum[3], 10);
    if (year < 100) year += 2000;
    const hour = mNum[4] ? parseInt(mNum[4], 10) : 0;
    const min  = mNum[5] ? parseInt(mNum[5], 10) : 0;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = new Date(Date.UTC(year, month - 1, day, hour - 4 /* Bolivia UTC-4 */, min));
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  // Intento 2: español "DD de Mes, YYYY a las HH:MM" o "DD de Mes de YYYY HH:MM"
  const meses: Record<string, number> = {
    enero:0, febrero:1, marzo:2, abril:3, mayo:4, junio:5,
    julio:6, agosto:7, septiembre:8, setiembre:8, octubre:9, noviembre:10, diciembre:11
  };
  const norm = trimmed.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const m = norm.match(/(\d{1,2})\s*de\s*([a-z]+)[,\s]+(?:de\s+)?(\d{4})(?:[\s,]+(?:a\s*las\s*)?(\d{1,2}):(\d{2}))?/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = meses[m[2]];
    const year = parseInt(m[3], 10);
    const hour = m[4] ? parseInt(m[4], 10) : 0;
    const min  = m[5] ? parseInt(m[5], 10) : 0;
    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
      const d = new Date(Date.UTC(year, month, day, hour - 4 /* Bolivia UTC-4 */, min));
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  // Intento 3 (último recurso): parser genérico de JS para otros formatos.
  const direct = new Date(trimmed);
  if (!isNaN(direct.getTime())) return direct.toISOString();

  return null;
}

// ─── Cálculo de monto esperado (server-side, autoritativo) ─────
// Reglas de Daniel:
//  - Caballo categoría FC → costo 0
//  - Caballo compartido (otra afiliación aprobada con costo_aplicado>0 ya pagó) → costo 0
//  - Caballo otro → tarifas.costo_caballo
//  - Jinete: 0 si TODOS los caballos son FC, sino tarifas.costo_jinete
async function calcularMontoEsperadoAfil(
  sb: any,
  afiliacionId: string,
  tarifas: TarifasAfil,
  fcCategoriaId: number,
): Promise<{ expected: number; desglose: Array<Record<string, unknown>> }> {
  const { data: caballos } = await sb
    .from('afiliacion_caballos')
    .select('id, nombre_caballo, categoria_id, afiliacion_compartida_id')
    .eq('afiliacion_id', afiliacionId);

  const lista = caballos || [];
  let total = 0;
  let tieneNoFC = false;
  const desglose: Array<Record<string, unknown>> = [];

  for (const c of lista) {
    const isFC = c.categoria_id === fcCategoriaId;
    let isCompartidoConfirmado = false;

    // Verificar compartido server-side: la afiliación referenciada debe estar aprobada
    if (!isFC && c.afiliacion_compartida_id) {
      const { data: orig } = await sb
        .from('afiliaciones')
        .select('id, estado')
        .eq('id', c.afiliacion_compartida_id)
        .single();
      isCompartidoConfirmado = !!(orig && orig.estado === 'aprobada');
    }

    let costo = 0;
    let motivo = '';
    if (isFC)                       { costo = 0;                     motivo = 'fc'; }
    else if (isCompartidoConfirmado){ costo = 0;                     motivo = 'compartido'; }
    else                            { costo = Number(tarifas.costo_caballo); motivo = 'normal'; tieneNoFC = true; }

    if (!isFC) tieneNoFC = tieneNoFC || true;
    total += costo;
    desglose.push({ id: c.id, nombre: c.nombre_caballo, categoria_id: c.categoria_id, costo, motivo });
  }

  // Jinete cobra solo si tiene al menos un caballo no-FC
  const tieneAlgunNoFC = lista.some((c: any) => c.categoria_id !== fcCategoriaId);
  const costoJinete = tieneAlgunNoFC ? Number(tarifas.costo_jinete) : 0;
  total += costoJinete;
  desglose.unshift({ concepto: 'jinete', costo: costoJinete, motivo: tieneAlgunNoFC ? 'tiene caballos no-fc' : 'todos fc' });

  return { expected: total, desglose };
}

// ─── Lógica de validación ─────────────────────────────────────
function validar(
  extracted: any,
  expected: number,
  ventanaDesde: Date,
  glosaEsperada: string | null,
): { estado: string; motivo: string|null } {
  // ── MISMO CRITERIO QUE `validar-comprobante` (inscripciones) ──────────────
  // Espejo del cambio del 18 y 20-ago. Esta función arrastraba la clasificación
  // vieja: UN solo balde donde todo rechaza. Dos reglas la corrigen:
  //
  // 1) DOS BALDES. La pregunta que decide: ¿el dinero llegó a la cuenta de
  //    ADESCRUZ? Si NO llegó → rechazada. Si llegó pero algo no cuadra (monto,
  //    glosa, moneda, fecha) → revision_manual: decide una persona.
  //
  // 2) LA CUENTA ES EL ANCLA. `cuenta_destino` es un número: robusto al OCR.
  //    `titular` y `banco` son nombres: frágiles al recorte y la resolución.
  //    Si la cuenta coincide, un nombre raro es casi seguro un error de
  //    lectura, no otro destinatario. (Caso Evie Davies: una captura cortada
  //    hizo leer "alidaz" por "alipaz" y auto-rechazó un pago correcto.)
  //
  // Pesa MÁS acá que en inscripciones: esto valida la campaña de cobranza de
  // afiliaciones. Rechazarle solo a alguien a quien le pediste que pague, y
  // que pagó, es el peor resultado posible del sistema.
  const duros: string[] = [];
  const blandos: string[] = [];

  const cuentaOk = !!extracted.cuenta_destino &&
    String(extracted.cuenta_destino).replace(/\s/g, '') === VALIDACION.cuenta_destino;

  if (!cuentaOk) {
    duros.push(`Cuenta destino: esperada ${VALIDACION.cuenta_destino}, leyó "${extracted.cuenta_destino || '—'}"`);
  }

  const balde = cuentaOk ? blandos : duros;   // con cuenta buena, el nombre no rechaza solo
  const nota  = cuentaOk ? ' (la cuenta destino SÍ coincide — probable error de lectura)' : '';

  if (!extracted.titular_destino || !VALIDACION.titular_destino_re.test(extracted.titular_destino)) {
    balde.push(`Titular destino: leyó "${extracted.titular_destino || '—'}"${nota}`);
  }
  if (!extracted.banco_destino || !VALIDACION.banco_destino_re.test(extracted.banco_destino)) {
    balde.push(`Banco destino: leyó "${extracted.banco_destino || '—'}"${nota}`);
  }
  const monto = Number(extracted.monto || 0);
  if (monto < expected) {
    blandos.push(`Monto bajo: pagó Bs ${monto}, esperaba Bs ${expected}`);
  }
  if (extracted.moneda && extracted.moneda !== 'BOB') {
    blandos.push(`Moneda: ${extracted.moneda} (debe ser BOB)`);
  }
  if (extracted.fecha_pago) {
    const fp = new Date(extracted.fecha_pago);
    if (isNaN(fp.getTime())) blandos.push('Fecha de pago no parseable');
    else if (fp < ventanaDesde) blandos.push(`Comprobante muy viejo (fecha ${extracted.fecha_pago})`);
  }
  if (glosaEsperada) {
    const glosaCompro = String(extracted.glosa || '').trim();
    if (!glosaCompro) {
      blandos.push(`Glosa: el comprobante no tiene concepto (se esperaba "${glosaEsperada}")`);
    } else {
      // sin acentos + LÍMITES DE PALABRA (evita "I CDS 2026" ⊂ "II CDS 2026")
      const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reGlosa = new RegExp('\\b' + esc(norm(glosaEsperada).trim()) + '\\b');
      if (!reGlosa.test(norm(glosaCompro))) {
        blandos.push(`Glosa: leyó "${glosaCompro}", esperaba que contenga "${glosaEsperada}"`);
      }
    }
  }

  const confianza = Number(extracted.confianza || 0);
  const faltaFecha = !extracted.fecha_pago;
  const faltaNro   = !extracted.nro_operacion;
  const faltaMonto = extracted.monto == null;

  // Duros (la cuenta destino no es la nuestra) → rechazada: el dinero no llegó
  // a ADESCRUZ. Si además hay blandos se informan todos juntos, para no obligar
  // al jinete a descubrir los problemas de a uno.
  if (duros.length > 0) {
    const todos = duros.concat(blandos).join('; ');
    if (confianza < 0.5) return { estado: 'revision_manual', motivo: `OCR poco confiable (${confianza}): ${todos}` };
    return { estado: 'rechazada', motivo: todos };
  }

  // Sin duros pero con blandos → revisión manual. El pago existe; lo resuelve
  // una persona. NUNCA se aprueba solo.
  if (blandos.length > 0) {
    return { estado: 'revision_manual', motivo: blandos.join('; ') };
  }

  // Sin errores, pero con datos incompletos o baja confianza → revisión manual.
  const revision: string[] = [];
  if (confianza < 0.7) revision.push(`OCR poco confiable (${confianza})`);
  if (faltaFecha)      revision.push('no se pudo leer la fecha del comprobante');
  if (faltaNro)        revision.push('no se pudo leer el N° de operación (no se puede chequear reúso)');
  if (faltaMonto)      revision.push('no se pudo leer el monto del comprobante');
  if (revision.length) return { estado: 'revision_manual', motivo: revision.join('; ') };

  return { estado: 'aprobada', motivo: null };
}

// ─── Handler principal ────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return jsonResp({ error: 'Method not allowed' }, 405);

  try {
    const payload = await req.json();
    // Acepta llamado directo del cliente { afiliacion_id } o webhook de DB { record: { id } }
    const afiliacion_id = payload?.afiliacion_id ?? payload?.record?.id ?? null;
    if (!afiliacion_id) return jsonResp({ error: 'afiliacion_id requerido' }, 400);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return jsonResp({ error: 'ANTHROPIC_API_KEY no configurada' }, 500);

    const supaUrl = Deno.env.get('SUPABASE_URL')!;
    const supaKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supaUrl, supaKey);

    // 1. Cargar afiliación
    const { data: afil, error: ae } = await sb.from('afiliaciones').select('*').eq('id', afiliacion_id).single();
    if (ae || !afil) return jsonResp({ error: 'Afiliación no encontrada' }, 404);

    // Idempotencia: si ya fue validada (por el navegador o por el trigger de respaldo), devolver lo guardado.
    if (afil.validacion_ocr) {
      return jsonResp({ ok: true, estado: afil.estado, motivo: afil.motivo_rechazo,
        monto_esperado: afil.monto_esperado, monto_pagado: afil.monto_pagado, cached: true });
    }

    if (!afil.comprobante_url) return jsonResp({ error: 'Afiliación sin comprobante' }, 400);

    // 2. Glosa esperada (de site_config)
    let glosaEsperada: string | null = null;
    const { data: glosaCfg } = await sb.from('site_config').select('value').eq('key', 'afiliacion_glosa_esperada').single();
    if (glosaCfg?.value) glosaEsperada = String(glosaCfg.value);

    // 3. ID de la categoría Futuros Campeones (regla de costos)
    const { data: fcRow } = await sb.from('categorias').select('id').eq('nombre', 'Futuros Campeones').single();
    const fcCategoriaId = fcRow?.id ?? 1; // fallback a 1 si no encuentra

    // 4. Cargar tarifas + calcular monto esperado server-side
    const { data: tarifasRow } = await sb.from('tarifas_afiliacion').select('costo_jinete, costo_caballo').eq('temporada', afil.temporada || 2026).single();
    const tarifas: TarifasAfil = tarifasRow ?? TARIFAS_FALLBACK;
    const { expected, desglose } = await calcularMontoEsperadoAfil(sb, afiliacion_id, tarifas, fcCategoriaId);

    // 5. Bajar comprobante
    const { data: file, error: dl } = await sb.storage.from('comprobantes').download(afil.comprobante_url);
    if (dl || !file) {
      const motivo = `No se pudo bajar el comprobante: ${dl?.message || 'unknown'}`;
      await sb.from('afiliaciones').update({
        estado: 'revision_manual', motivo_rechazo: motivo, monto_esperado: expected,
        validacion_ocr: { error: motivo, ts: new Date().toISOString() },
      }).eq('id', afiliacion_id);
      return jsonResp({ ok: false, estado: 'revision_manual', motivo }, 200);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = bytesToBase64(bytes);
    const mediaType = detectMediaType(afil.comprobante_url);

    // 6. OCR con Claude
    let extracted;
    try { extracted = await callClaudeVision(base64, mediaType, apiKey); }
    catch (err) {
      const motivo = `Error OCR: ${err.message}`;
      await sb.from('afiliaciones').update({
        estado: 'revision_manual', motivo_rechazo: motivo, monto_esperado: expected,
        validacion_ocr: { error: err.message, ts: new Date().toISOString() },
      }).eq('id', afiliacion_id);
      return jsonResp({ ok: false, estado: 'revision_manual', motivo }, 200);
    }

    // Normalizar fecha_pago a ISO 8601 (Claude a veces devuelve formato español)
    const fechaPagoOriginal = extracted.fecha_pago;
    extracted.fecha_pago = parseFechaPago(fechaPagoOriginal);

    // 7. Validar
    const ventanaDesde = new Date(Date.now() - VALIDACION.ventana_dias_atras * 86400000);
    let { estado, motivo } = validar(extracted, expected, ventanaDesde, glosaEsperada);

    // 8. Anti-reúso ATÓMICO (cross-table, sin race): al APROBAR, reclamar el nro_operacion en
    //    operaciones_consumidas (PK única). Si ya lo consumió OTRO comprobante → reúso → rechazada.
    const nroOp = extracted.nro_operacion ? String(extracted.nro_operacion).trim() : null;
    if (estado === 'aprobada' && nroOp) {
      const { error: claimErr } = await sb.from('operaciones_consumidas')
        .insert({ nro_operacion: nroOp, origen: 'afiliacion', ref_id: afiliacion_id });
      if (claimErr) {
        if (claimErr.code === '23505') {
          const { data: ex } = await sb.from('operaciones_consumidas').select('ref_id').eq('nro_operacion', nroOp).single();
          if (!ex || ex.ref_id !== afiliacion_id) {
            estado = 'rechazada';
            motivo = `N° de operación ${nroOp} ya fue usado en otro comprobante (reúso)` + (motivo ? '; ' + motivo : '');
          }
        } else {
          console.error('operaciones_consumidas claim error (afiliacion):', claimErr);
        }
      }
    }

    // 9. Actualizar afiliación
    const update: Record<string, unknown> = {
      estado,
      monto_esperado: expected,
      monto_pagado: extracted.monto || null,
      banco_origen: extracted.banco_origen || null,
      titular_origen: extracted.titular_origen || null,
      fecha_pago: extracted.fecha_pago || null,
      glosa: extracted.glosa || null,
      validacion_ocr: { extracted, validacion: { estado, motivo, expected, desglose }, ts: new Date().toISOString() },
      revisado_en: new Date().toISOString(),
      motivo_rechazo: motivo,
    };
    if (nroOp) update.nro_operacion = nroOp;

    const { error: ue } = await sb.from('afiliaciones').update(update).eq('id', afiliacion_id);
    if (ue) return jsonResp({ error: 'No se pudo actualizar: ' + ue.message }, 500);

    return jsonResp({ ok: true, estado, motivo, monto_esperado: expected, monto_pagado: extracted.monto, extracted, desglose });

  } catch (err) {
    console.error('validar-comprobante-afiliacion error:', err);
    return jsonResp({ error: err.message || 'Error inesperado' }, 500);
  }
});
