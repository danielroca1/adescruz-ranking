// ============================================================
// Edge Function: purgar-comprobantes
// Política de retención de archivos del bucket `comprobantes`.
// Polled by pg_cron monthly (1st of month, 03:00 Bolivia / 07:00 UTC).
//
// Reglas (decididas por Daniel 2026-05-04):
//   - inscripciones: borrar comprobante 6 meses post created_at,
//                    si estado in ('aprobada','rechazada')
//   - afiliaciones:  borrar comprobante 18 meses post created_at,
//                    si estado in ('aprobada','rechazada')
//
// Lo que se borra: el archivo del bucket. La fila de DB queda con
// `comprobante_purgado_en` seteado y `comprobante_url` nullado para que
// nadie genere signed URLs rotas. validacion_ocr conserva banco/monto/
// fecha/nro_operacion como audit trail.
//
// Idempotente: filtra por comprobante_purgado_en IS NULL.
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const TERMINAL_ESTADOS = ['aprobada', 'rechazada'];

// Días de retención por tabla
const RETENTION_DAYS = {
  inscripciones: 180,  // 6 meses
  afiliaciones:  548,  // 18 meses (~365 + 183)
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface Row {
  id: string;
  comprobante_url: string;
  created_at: string;
}

async function purgarTabla(
  sb: ReturnType<typeof createClient>,
  tabla: 'inscripciones' | 'afiliaciones',
): Promise<{ tabla: string; candidates: number; deleted: number; failed: number; details: any[] }> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS[tabla] * 86400000).toISOString();

  const { data, error } = await sb
    .from(tabla)
    .select('id, comprobante_url, created_at')
    .in('estado', TERMINAL_ESTADOS)
    .not('comprobante_url', 'is', null)
    .is('comprobante_purgado_en', null)
    .lt('created_at', cutoff)
    .limit(500);  // safety cap per run

  if (error) {
    console.error(`[${tabla}] query error:`, error);
    return { tabla, candidates: 0, deleted: 0, failed: 0, details: [{ error: error.message }] };
  }

  const rows = (data || []) as Row[];
  const candidates = rows.length;
  let deleted = 0;
  let failed = 0;
  const details: any[] = [];

  for (const row of rows) {
    const url = row.comprobante_url;
    // Borrar archivo del bucket (best effort — si ya no existe, sigue)
    const { error: delErr } = await sb.storage.from('comprobantes').remove([url]);
    if (delErr) {
      // 404 = ya no existe en bucket. Lo tratamos como éxito y marcamos purgado.
      const is404 = /not\s*found|no.*exist/i.test(delErr.message || '');
      if (!is404) {
        console.warn(`[${tabla}] failed to delete ${url}:`, delErr.message);
        details.push({ id: row.id, url, error: delErr.message });
        failed++;
        continue;
      }
    }

    // Marcar row como purgado y nullar comprobante_url
    const { error: updErr } = await sb.from(tabla).update({
      comprobante_purgado_en: new Date().toISOString(),
      comprobante_url: null,
    }).eq('id', row.id);

    if (updErr) {
      console.warn(`[${tabla}] file deleted but DB update failed for ${row.id}:`, updErr.message);
      details.push({ id: row.id, url, error: 'file deleted, DB update failed: ' + updErr.message });
      failed++;
      continue;
    }

    deleted++;
    details.push({ id: row.id, url, age_days: Math.round((Date.now() - new Date(row.created_at).getTime()) / 86400000) });
  }

  return { tabla, candidates, deleted, failed, details };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const ts = new Date().toISOString();
  console.log('purgar-comprobantes tick:', ts);

  try {
    const supaUrl = Deno.env.get('SUPABASE_URL')!;
    const supaKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supaUrl, supaKey);

    const inscResult = await purgarTabla(sb, 'inscripciones');
    const afilResult = await purgarTabla(sb, 'afiliaciones');

    const summary = {
      ts,
      inscripciones: { candidates: inscResult.candidates, deleted: inscResult.deleted, failed: inscResult.failed },
      afiliaciones:  { candidates: afilResult.candidates, deleted: afilResult.deleted, failed: afilResult.failed },
      total_deleted: inscResult.deleted + afilResult.deleted,
    };
    console.log('purgar-comprobantes summary:', JSON.stringify(summary));

    return jsonResp({ ok: true, ...summary, details: { inscripciones: inscResult.details, afiliaciones: afilResult.details } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('purgar-comprobantes error:', err);
    return jsonResp({ ok: false, error: msg }, 500);
  }
});
