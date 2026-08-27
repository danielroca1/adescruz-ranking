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
import {
  VALIDACION, corsHeaders, PROMPT_OCR,
  jsonResp, callClaudeVision, detectMediaType, bytesToBase64, parseFechaPago,
  normalizarNroOperacion,
  validarPago,
} from '../_shared/validacion-pagos.ts';

// Tarifas dinámicas — leídas de tabla tarifas_afiliacion
type TarifasAfil = {
  costo_jinete: number;
  costo_caballo: number;
};
const TARIFAS_FALLBACK: TarifasAfil = { costo_jinete: 500, costo_caballo: 210 };

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
    //
    // Mismas dos excepciones que en `validar-comprobante` (ver el comentario largo allá):
    // un `validacion_ocr` que solo tiene `error` es un fallo de infraestructura y no gasta el
    // intento — si no, la fila queda trabada aunque se arregle el bug y se redespliegue —
    // pero una fila ya APROBADA no se re-valida nunca: no se desanda una decisión humana.
    const ocrFalloInfra = !!afil.validacion_ocr && !!afil.validacion_ocr.error;
    if (afil.validacion_ocr && (!ocrFalloInfra || afil.estado === 'aprobada')) {
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
    let { estado, motivo } = validarPago(extracted, { expected, ventanaDesde, glosaEsperada, exigirMonto: true });

    // 8. Anti-reúso ATÓMICO (cross-table, sin race): al APROBAR, reclamar el nro_operacion en
    //    operaciones_consumidas (PK única). Si ya lo consumió OTRO comprobante → reúso → rechazada.
    // Un N° de operación va a una PK: se descarta lo que no sea un código (ver
    // normalizarNroOperacion). El OCR ya devolvió la glosa acá una vez, y esa
    // reserva basura bloqueó la siguiente aprobación.
    const nroOp = normalizarNroOperacion(extracted.nro_operacion);
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
