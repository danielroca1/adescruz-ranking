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
import {
  VALIDACION, corsHeaders, PROMPT_OCR,
  jsonResp, callClaudeVision, detectMediaType, bytesToBase64, parseFechaPago,
  normalizarNroOperacion,
  validarPago,
} from '../_shared/validacion-pagos.ts';

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
    //
    // DOS EXCEPCIONES, las dos aprendidas del bug de `CLAUDE_API` (20 al 27-ago-2026):
    //
    // 1. Un `validacion_ocr` que solo tiene `error` NO es una validación: es un fallo de
    //    infraestructura (la API caída, un secret mal puesto, el bug de las constantes).
    //    Guardarlo acá trababa la fila para siempre — ni arreglando y redesplegando volvía a
    //    intentar, porque el guard veía la columna llena. Un error de infra no gasta el intento.
    //
    // 2. Pero una fila ya APROBADA no se re-valida nunca, ni con error cacheado. Las 8
    //    inscripciones del XIII las verificó Daniel a mano contra el comprobante; volver a
    //    correr el OCR sobre ellas podría bajarlas a `revision_manual` o `rechazada` y
    //    desandar una decisión humana. Una relectura suma evidencia, no vuelve a decidir.
    const ocrFalloInfra = !!insc.validacion_ocr && !!insc.validacion_ocr.error;
    if (insc.validacion_ocr && (!ocrFalloInfra || insc.estado === 'aprobada')) {
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
          .select('glosa_esperada, cierre_fecha, cierre_ejecutado_en, inscripciones_abiertas')
          .eq('temporada', 2026).eq('numero', num).single();
        glosaEsperada = campRow?.glosa_esperada ?? null;

        // ── NO SE PUEDE LLEGAR TARDE A UN PLAZO QUE NO PASÓ ──────────────
        //
        // Antes esto comparaba contra `cierre_fecha` a secas, que es la hora
        // AGENDADA del cierre, no el cierre real. Con las inscripciones
        // abiertas y una fecha vieja, TODO pago entrante quedaba marcado como
        // "posterior al cierre" y caía a revisión manual.
        //
        // Pasó de verdad: el XIII CDS se postergó por lluvia el 20-ago-2026,
        // `cierre_activo` se apagó a mano y las fechas nunca se movieron. El
        // 27-ago las inscripciones seguían abiertas contra un cierre agendado
        // para el 21 — seis días antes. La primera inscripción que entró con
        // el OCR ya arreglado (pago impecable: cuenta, glosa, monto y N° de
        // operación correctos) se frenó por eso y solo por eso.
        //
        // REGLA: el chequeo necesita saber CUÁNDO se cerró de verdad, y eso lo
        // dice `cierre_ejecutado_en`. `cierre_fecha` es un PLAN, y los planes
        // cambian — este incidente es exactamente un plan que cambió. Usar el
        // plan como si fuera un hecho es lo que rompió.
        //
        // Así que solo se compara si el cierre REALMENTE ocurrió y las
        // inscripciones están cerradas. Si se cerró a mano (sin que el cron
        // sellara `cierre_ejecutado_en`) no sabemos el momento, y adivinarlo
        // con la hora agendada reintroduce el mismo bug.
        //
        // Es un chequeo BLANDO: no aplicarlo nunca aprueba de más por sí solo,
        // solo deja de mandar a revisión manual pagos que no tienen nada malo.
        const abiertas = campRow?.inscripciones_abiertas === true;
        const cierreReal = campRow?.cierre_ejecutado_en ?? null;
        if (!abiertas && cierreReal) {
          const cf = new Date(cierreReal);
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
    let { estado, motivo } = validarPago(extracted, { expected, ventanaDesde, glosaEsperada, cierreFecha });

    // 7. Anti-reúso ATÓMICO (cross-table, sin race): al APROBAR, reclamar el nro_operacion en
    //    operaciones_consumidas (PK única). Si ya lo consumió OTRO comprobante → reúso → rechazada.
    // Un N° de operación va a una PK: se descarta lo que no sea un código (ver
    // normalizarNroOperacion). El OCR ya devolvió la glosa acá una vez, y esa
    // reserva basura bloqueó la siguiente aprobación.
    const nroOp = normalizarNroOperacion(extracted.nro_operacion);
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
