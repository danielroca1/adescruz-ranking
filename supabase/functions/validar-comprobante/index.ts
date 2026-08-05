// ============================================================
// Edge Function: validar-comprobante
// Recibe { inscripcion_id }, baja el comprobante, lo manda a
// Claude Vision, valida contra reglas de pago, actualiza
// la inscripción con el resultado.
//
// Secrets requeridos (Supabase Dashboard → Functions → Secrets):
//   ANTHROPIC_API_KEY     — sk-ant-api03-...
//   SUPABASE_URL          — auto-provisto por Supabase (no hace falta crearlo)
//   SUPABASE_SERVICE_ROLE_KEY — auto-provisto por Supabase
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// ─── Config ────────────────────────────────────────────────────
const CLAUDE_MODEL = 'claude-sonnet-4-5';   // multimodal, soporta vision
const CLAUDE_API   = 'https://api.anthropic.com/v1/messages';

// Reglas de pago duras (datos del beneficiario ADESCRUZ)
const VALIDACION = {
  cuenta_destino: '2000274154',
  titular_destino_re: /bedoya\s+alipaz\s+nicol/i,
  // Acepta: "Banco Nacional", "Banco Nacional de Bolivia", "BNB", "B.N.B.", "B N B"
  banco_destino_re:   /banco\s*nacional(?:\s+de\s+bolivia)?|\bb\.?\s*n\.?\s*b\.?\b/i,
  ventana_dias_atras: 60,  // comprobante no puede ser más viejo que esto
};

// Tarifas dinámicas — leídas de tabla tarifas_inscripcion. Mismo cálculo que admin.html.
type Tarifas = {
  fc_ambos: number;
  general_ambos: number;
  segunda_pasada_dia: number;
  ultimo_momento: number;
  descuento_un_dia: number;
};
const TARIFAS_FALLBACK: Tarifas = {
  fc_ambos: 200, general_ambos: 250, segunda_pasada_dia: 50, ultimo_momento: 500, descuento_un_dia: 0.5,
};

function calcularMontoEsperado(
  catConcurso: string, dias: string, esSegundaPasada: boolean, esUltimoMomento: boolean, t: Tarifas,
): number {
  const esAmbos = String(dias).toLowerCase() === 'ambos';
  if (esUltimoMomento) return Number(t.ultimo_momento);
  if (esSegundaPasada) return esAmbos ? Number(t.segunda_pasada_dia) * 2 : Number(t.segunda_pasada_dia);
  const esFC = /futur|fut\.?\s*camp|^fc\b/i.test(catConcurso || '');
  const baseAmbos = esFC ? Number(t.fc_ambos) : Number(t.general_ambos);
  return esAmbos ? baseAmbos : Math.round(baseAmbos * Number(t.descuento_un_dia));
}

// CORS para llamados desde el browser
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Prompt para Claude Vision ─────────────────────────────────
const PROMPT_OCR = `You are an OCR specialist analyzing a Bolivian bank transfer receipt (comprobante de pago bancario).

Extract these fields and return ONLY a single valid JSON object — no markdown, no commentary, no code fences.

Required JSON shape:
{
  "banco_origen": string|null,        // e.g. "Banco Ganadero", "BMSC", "Banco Mercantil Santa Cruz"
  "titular_origen": string|null,       // Name of the person/entity who paid
  "monto": number|null,                // Amount in Bs. Number only, no currency symbol
  "moneda": "BOB"|"USD"|null,
  "fecha_pago": string|null,           // ISO 8601 with time if visible (YYYY-MM-DDTHH:MM:SS), Bolivia timezone
  "nro_operacion": string|null,         // Transaction/operation/reference number
  "cuenta_destino": string|null,        // Destination account number
  "titular_destino": string|null,       // Name of recipient
  "banco_destino": string|null,         // Destination bank name
  "glosa": string|null,                 // Reason / concept / "concepto" / description
  "tipo_transaccion": string|null,      // "transferencia" | "QR" | "deposito" | etc.
  "confianza": number,                  // YOUR confidence (0.0-1.0) that the extraction is reliable
  "notas": string|null                  // Any caveats: image cut off, blurry, ambiguous fields
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
  // Strip code fences if Claude added them despite instructions
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); }
  catch (e) { throw new Error(`Claude returned non-JSON: ${cleaned.slice(0, 200)}`); }
}

function detectMediaType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'png')  return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif')  return 'image/gif';
  if (ext === 'pdf')  return 'application/pdf';  // Claude soporta PDFs en algunos modelos
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

// ─── Lógica de validación ─────────────────────────────────────
function validar(
  extracted: any,
  expected: number,
  ventanaDesde: Date,
  glosaEsperada: string | null,
  cierreFecha: Date | null,
): { estado: string; motivo: string|null } {
  const errors: string[] = [];

  // Cuenta destino
  if (!extracted.cuenta_destino || String(extracted.cuenta_destino).replace(/\s/g,'') !== VALIDACION.cuenta_destino) {
    errors.push(`Cuenta destino: esperada ${VALIDACION.cuenta_destino}, leyó "${extracted.cuenta_destino || '—'}"`);
  }
  // Titular destino
  if (!extracted.titular_destino || !VALIDACION.titular_destino_re.test(extracted.titular_destino)) {
    errors.push(`Titular destino: leyó "${extracted.titular_destino || '—'}"`);
  }
  // Banco destino
  if (!extracted.banco_destino || !VALIDACION.banco_destino_re.test(extracted.banco_destino)) {
    errors.push(`Banco destino: leyó "${extracted.banco_destino || '—'}"`);
  }
  // Monto
  const monto = Number(extracted.monto || 0);
  if (monto < expected) {
    errors.push(`Monto bajo: pagó Bs ${monto}, esperaba Bs ${expected}`);
  }
  // Moneda
  if (extracted.moneda && extracted.moneda !== 'BOB') {
    errors.push(`Moneda: ${extracted.moneda} (debe ser BOB)`);
  }
  // Fecha en ventana + no posterior al cierre del CDS
  if (extracted.fecha_pago) {
    const fp = new Date(extracted.fecha_pago);
    if (isNaN(fp.getTime())) {
      errors.push('Fecha de pago no parseable');
    } else {
      if (fp < ventanaDesde) {
        errors.push(`Comprobante muy viejo (fecha ${extracted.fecha_pago})`);
      }
      if (cierreFecha && fp > cierreFecha) {
        const cierreLocal = cierreFecha.toLocaleString('es-BO', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
          timeZone: 'America/La_Paz',
        });
        errors.push(`Comprobante posterior al cierre del CDS (cerró ${cierreLocal})`);
      }
    }
  }
  // Glosa: comprobante debe contener la glosa esperada del CDS
  if (glosaEsperada) {
    const glosaCompro = String(extracted.glosa || '').trim();
    if (!glosaCompro) {
      errors.push(`Glosa: el comprobante no tiene concepto (se esperaba "${glosaEsperada}")`);
    } else {
      // Case-insensitive, sin acentos y con LÍMITES DE PALABRA: evita que "I CDS 2026"
      // matchee dentro de "II CDS 2026" (números romanos que son prefijo de otros).
      const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reGlosa = new RegExp('\\b' + esc(norm(glosaEsperada).trim()) + '\\b');
      if (!reGlosa.test(norm(glosaCompro))) {
        errors.push(`Glosa: leyó "${glosaCompro}", esperaba que contenga "${glosaEsperada}"`);
      }
    }
  }

  const confianza = Number(extracted.confianza || 0);
  const faltaFecha = !extracted.fecha_pago;
  const faltaNro   = !extracted.nro_operacion;

  // Errores duros (cuenta/titular/banco/monto/moneda/glosa/fecha-fuera-de-rango) → rechazada,
  // salvo que el OCR sea poco confiable, en cuyo caso lo revisa un humano.
  if (errors.length > 0) {
    if (confianza < 0.5) return { estado: 'revision_manual', motivo: `OCR poco confiable (${confianza}): ${errors.join('; ')}` };
    return { estado: 'rechazada', motivo: errors.join('; ') };
  }

  // Sin errores duros, pero con datos incompletos o baja confianza → revisión manual.
  // No aprobamos automáticamente algo que no pudimos verificar del todo.
  const revision: string[] = [];
  if (confianza < 0.7) revision.push(`OCR poco confiable (${confianza})`);
  if (faltaFecha)      revision.push('no se pudo leer la fecha del comprobante');
  if (faltaNro)        revision.push('no se pudo leer el N° de operación (no se puede chequear reúso)');
  if (revision.length) return { estado: 'revision_manual', motivo: revision.join('; ') };

  return { estado: 'aprobada', motivo: null };
}

// ─── Handler principal ────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return jsonResp({ error: 'Method not allowed' }, 405);

  try {
    const payload = await req.json();
    // Acepta llamado directo del cliente { inscripcion_id } o webhook de DB { record: { id } }
    const inscripcion_id = payload?.inscripcion_id ?? payload?.record?.id ?? null;
    if (!inscripcion_id) return jsonResp({ error: 'inscripcion_id requerido' }, 400);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return jsonResp({ error: 'ANTHROPIC_API_KEY no configurada' }, 500);

    const supaUrl = Deno.env.get('SUPABASE_URL')!;
    const supaKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supaUrl, supaKey);

    // 1. Fetch inscripción + glosa esperada del CDS
    const { data: insc, error: ie } = await sb.from('inscripciones').select('*').eq('id', inscripcion_id).single();
    if (ie || !insc) return jsonResp({ error: 'Inscripción no encontrada' }, 404);

    // Idempotencia: si ya fue validada (por el navegador del jinete o por el trigger de respaldo),
    // devolver el resultado guardado sin volver a llamar a Claude. Evita doble cobro de API y doble proceso.
    if (insc.validacion_ocr) {
      return jsonResp({ ok: true, estado: insc.estado, motivo: insc.motivo_rechazo,
        monto_esperado: insc.monto_esperado, monto_pagado: insc.monto_pagado, cached: true });
    }

    if (!insc.comprobante_url) return jsonResp({ error: 'Inscripción sin comprobante' }, 400);

    // Buscar el campeonato por concurso_id (e.g. "V-CDS-2026" → numero=5) para
    // obtener glosa_esperada y cierre_fecha (esta última usada para validar
    // que el comprobante no sea posterior al cierre).
    let glosaEsperada: string | null = null;
    let cierreFecha: Date | null = null;
    const numeroMatch = String(insc.concurso_id).match(/^([IVXLCDM]+)-CDS-2026$/i);
    if (numeroMatch) {
      const ROMAN_TO_NUM: Record<string, number> = { I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12,XIII:13,XIV:14,XV:15,XVI:16,XVII:17,XVIII:18,XIX:19,XX:20 };
      const num = ROMAN_TO_NUM[numeroMatch[1].toUpperCase()];
      if (num) {
        const { data: campRow } = await sb.from('campeonatos')
          .select('glosa_esperada, cierre_fecha')
          .eq('temporada', 2026).eq('numero', num).single();
        glosaEsperada = campRow?.glosa_esperada ?? null;
        if (campRow?.cierre_fecha) {
          const cf = new Date(campRow.cierre_fecha);
          if (!isNaN(cf.getTime())) cierreFecha = cf;
        }
      }
    }

    // 2. Detectar 2da pasada: mismo BINOMIO (jinete + equino) con una inscripción anterior
    //    en el mismo CDS, SIN importar la categoría. Otro caballo = binomio nuevo = tarifa completa.
    const { data: prev } = await sb.from('inscripciones')
      .select('id').eq('concurso_id', insc.concurso_id).eq('nombre', insc.nombre)
      .eq('equino', insc.equino).lt('created_at', insc.created_at).limit(1);
    const esSegundaPasada = Boolean(prev && prev.length);

    // 3. Cargar tarifas + calcular monto esperado
    const { data: tarifasRow } = await sb.from('tarifas_inscripcion').select('*').eq('temporada', 2026).single();
    const tarifas: Tarifas = tarifasRow ?? TARIFAS_FALLBACK;
    const expected = calcularMontoEsperado(insc.cat_concurso, insc.dias, esSegundaPasada, false, tarifas);

    // 4. Bajar comprobante
    const { data: file, error: dl } = await sb.storage.from('comprobantes').download(insc.comprobante_url);
    if (dl || !file) {
      const motivo = 'No se pudo bajar el comprobante: ' + (dl?.message || 'desconocido');
      await sb.from('inscripciones').update({
        estado: 'revision_manual', motivo_rechazo: motivo, revisado_en: new Date().toISOString(),
      }).eq('id', inscripcion_id);
      return jsonResp({ ok: false, estado: 'revision_manual', motivo }, 200);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = bytesToBase64(bytes);
    const mediaType = detectMediaType(insc.comprobante_url);

    // 5. OCR con Claude
    let extracted;
    try { extracted = await callClaudeVision(base64, mediaType, apiKey); }
    catch (err) {
      const motivo = `Error OCR: ${err.message}`;
      await sb.from('inscripciones').update({
        estado: 'revision_manual', motivo_rechazo: motivo, monto_esperado: expected,
        validacion_ocr: { error: err.message, ts: new Date().toISOString() },
      }).eq('id', inscripcion_id);
      return jsonResp({ ok: false, estado: 'revision_manual', motivo }, 200);
    }

    // Normalizar fecha_pago a ISO 8601 (Claude a veces devuelve formato español)
    extracted.fecha_pago = parseFechaPago(extracted.fecha_pago);

    // 6. Validar
    const ventanaDesde = new Date(Date.now() - VALIDACION.ventana_dias_atras * 86400000);
    let { estado, motivo } = validar(extracted, expected, ventanaDesde, glosaEsperada, cierreFecha);

    // 7. Anti-reúso ATÓMICO (cross-table, sin race): al APROBAR, reclamar el nro_operacion en
    //    operaciones_consumidas (PK única). Si ya lo consumió OTRO comprobante → reúso → rechazada.
    const nroOp = extracted.nro_operacion ? String(extracted.nro_operacion).trim() : null;
    if (estado === 'aprobada' && nroOp) {
      const { error: claimErr } = await sb.from('operaciones_consumidas')
        .insert({ nro_operacion: nroOp, origen: 'inscripcion', ref_id: inscripcion_id });
      if (claimErr) {
        if (claimErr.code === '23505') {
          const { data: ex } = await sb.from('operaciones_consumidas').select('ref_id').eq('nro_operacion', nroOp).single();
          if (!ex || ex.ref_id !== inscripcion_id) {
            estado = 'rechazada';
            motivo = `N° de operación ${nroOp} ya fue usado en otro comprobante (reúso)` + (motivo ? '; ' + motivo : '');
          }
        } else {
          console.error('operaciones_consumidas claim error (inscripcion):', claimErr);
        }
      }
    }

    // 8. Actualizar inscripción
    const update: Record<string, unknown> = {
      estado,
      monto_esperado: expected,
      monto_pagado: extracted.monto || null,
      banco_origen: extracted.banco_origen || null,
      titular_origen: extracted.titular_origen || null,
      fecha_pago: extracted.fecha_pago || null,
      glosa: extracted.glosa || null,
      validacion_ocr: { extracted, validacion: { estado, motivo, expected }, ts: new Date().toISOString() },
      revisado_en: new Date().toISOString(),
      motivo_rechazo: motivo,
    };
    if (nroOp) update.nro_operacion = nroOp;

    const { error: ue } = await sb.from('inscripciones').update(update).eq('id', inscripcion_id);
    if (ue) return jsonResp({ error: 'No se pudo actualizar: ' + ue.message }, 500);

    return jsonResp({ ok: true, estado, motivo, monto_esperado: expected, monto_pagado: extracted.monto, extracted });

  } catch (err) {
    console.error('validar-comprobante error:', err);
    return jsonResp({ error: err.message || 'Error inesperado' }, 500);
  }
});
