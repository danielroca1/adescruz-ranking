// Edge Function: cierre-inscripciones
// Per-CDS auto-close. Polled by pg_cron every 5 minutes.
//
// Flow:
//   1. SELECT campeonatos WHERE cierre_activo AND cierre_ejecutado_en IS NULL
//      AND cierre_fecha <= NOW() AND inscripciones_abiertas
//   2. For each matching CDS:
//      a. Build concurso_id ("V-CDS-2026" style) from numero+temporada
//      b. Fetch its inscriptions filtered by concurso_id
//      c. Generate Excel grouped by category
//      d. Email Excel to per-CDS cierre_emails recipients
//      e. Mark CDS as closed: inscripciones_abiertas=false,
//         cierre_ejecutado_en=NOW()
//
// Idempotent: cierre_ejecutado_en gate prevents reprocessing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import * as XLSX from "npm:xlsx";
import { encodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const resendApiKey = Deno.env.get("RESEND_API_KEY");

if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
  throw new Error("Missing required environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ─── Helpers ─────────────────────────────────────────────────

function intToRoman(n: number): string {
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
  ];
  let result = "";
  for (const [v, s] of map) {
    while (n >= v) { result += s; n -= v; }
  }
  return result;
}

function buildConcursoId(numero: number, temporada: number): string {
  return `${intToRoman(numero)}-CDS-${temporada}`;
}

interface Campeonato {
  id: number;
  numero: number;
  nombre: string;
  temporada: number;
  cierre_emails: string | null;
}

interface Inscripcion {
  id: string;
  nombre: string;
  club: string;
  equino: string;
  cat_concurso: string;
  dias: string;
  celular: string;
  created_at: string;
}

// ─── Excel generation ────────────────────────────────────────

async function generateExcel(inscripciones: Inscripcion[]): Promise<string> {
  const grouped: Record<string, Inscripcion[]> = {};
  inscripciones.forEach((insc) => {
    const cat = insc.cat_concurso || "(Sin categoría)";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(insc);
  });
  Object.keys(grouped).forEach((cat) => {
    grouped[cat].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });

  const wb = XLSX.utils.book_new();

  Object.entries(grouped).forEach(([category, items]) => {
    const wsData: (string | number)[][] = [
      ["Orden#", "Nombre", "Club", "Equino", "Días", "Celular"],
    ];
    items.forEach((item, idx) => {
      wsData.push([idx + 1, item.nombre, item.club, item.equino, item.dias, item.celular]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    for (let col = 0; col < 6; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: { bold: true, color: { rgb: "FFFFFFFF" } },
          fill: { fgColor: { rgb: "FF1a4731" } },
          alignment: { horizontal: "center" },
        };
      }
    }
    wsData.forEach((_, rowIdx) => {
      if (rowIdx === 0) return;
      const bgColor = rowIdx % 2 === 0 ? "FFFFFFFF" : "FFF0F7F4";
      for (let col = 0; col < 6; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: col });
        if (ws[cellRef]) ws[cellRef].s = { fill: { fgColor: { rgb: bgColor } } };
      }
    });
    ws["!cols"] = [8, 25, 20, 25, 12, 15].map((w) => ({ wch: w }));

    // Sheet name max 31 chars and no special chars
    const safeName = category.substring(0, 31).replace(/[\\/?*[\]:]/g, "_");
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return encodeBase64(wbout);
}

// ─── Email ───────────────────────────────────────────────────

async function sendEmail(
  to: string[],
  subject: string,
  htmlBody: string,
  attachmentBase64: string,
  filename: string,
): Promise<boolean> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "no-reply@adescruz.com",
        to,
        subject,
        html: htmlBody,
        attachments: [{
          filename,
          content: attachmentBase64,
          content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }],
      }),
    });
    if (!response.ok) {
      const error = await response.text();
      console.error(`Resend error (${response.status}):`, error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("sendEmail exception:", error);
    return false;
  }
}

// ─── Per-CDS processor ───────────────────────────────────────

async function processCampeonato(c: Campeonato): Promise<{ ok: boolean; reason: string }> {
  const concursoId = buildConcursoId(c.numero, c.temporada);
  console.log(`Processing ${c.nombre} (concurso_id=${concursoId})`);

  // 1) Mark closed FIRST. If we crash mid-flight at least registrations
  //    won't keep coming in. cierre_ejecutado_en gates re-runs.
  const { error: updErr } = await supabase
    .from("campeonatos")
    .update({
      inscripciones_abiertas: false,
      cierre_ejecutado_en: new Date().toISOString(),
    })
    .eq("id", c.id);

  if (updErr) {
    console.error(`Failed to mark CDS ${c.id} as closed:`, updErr);
    return { ok: false, reason: `update failed: ${updErr.message}` };
  }

  // 2) Fetch this CDS's inscriptions only.
  //
  // Filtro PERMISIVO, el que define [[orden-de-ingreso]]: todas menos las
  // `rechazada`. Antes no habia filtro de estado ninguno, asi que un jinete
  // rechazado por no pagar aparecia en el Excel que se le manda al jurado como
  // uno mas de la lista. Encontrado el 19-ago-2026, antes del cierre del XIII.
  //
  // Permisivo y no estricto (solo `aprobada`) a proposito: a la hora del cierre
  // puede haber pagos todavia en `revision_manual` o `pendiente`, y esa gente SI
  // compite. Dejarlos afuera del orden de ingreso es peor error que incluirlos.
  //
  // El `estado.is.null` esta para que una fila con estado nulo no se caiga en
  // silencio: en Postgres `NULL <> 'rechazada'` no es TRUE, asi que un `.neq`
  // pelado la descartaria sin avisar.
  const { data: inscripciones, error: inscErr } = await supabase
    .from("inscripciones")
    .select("id, nombre, club, equino, cat_concurso, dias, celular, created_at, estado")
    .eq("concurso_id", concursoId)
    .or("estado.is.null,estado.neq.rechazada")
    .order("cat_concurso", { ascending: true })
    .order("created_at", { ascending: true });

  if (inscErr) {
    console.error(`Failed to fetch inscripciones for ${concursoId}:`, inscErr);
    return { ok: false, reason: `fetch failed: ${inscErr.message}` };
  }

  if (!inscripciones || inscripciones.length === 0) {
    console.log(`No inscriptions for ${concursoId} — closing without email`);
    await marcarEmailEnviado(c.id);  // nada que mandar → no reintentar
    return { ok: true, reason: "no inscriptions, closed silently" };
  }

  // 3) Recipients (per-CDS)
  const recipients = (c.cierre_emails || "")
    .split(",").map((e) => e.trim()).filter((e) => e);

  if (recipients.length === 0) {
    console.warn(`No cierre_emails for ${concursoId} — closed but no email sent`);
    await marcarEmailEnviado(c.id);  // sin destinatarios → es config, no error transitorio: no reintentar
    return { ok: true, reason: "closed but no recipients configured" };
  }

  // 4) Build Excel + summary
  const excelBase64 = await generateExcel(inscripciones as Inscripcion[]);
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `Lista_Inscritos_${concursoId}_${dateStr}.xlsx`;

  const countByCat: Record<string, number> = {};
  (inscripciones as Inscripcion[]).forEach((i) => {
    countByCat[i.cat_concurso] = (countByCat[i.cat_concurso] || 0) + 1;
  });
  const summaryHtml = Object.entries(countByCat)
    .map(([cat, n]) => `<li><strong>${cat}:</strong> ${n} inscripción${n === 1 ? "" : "es"}</li>`)
    .join("");

  const emailBody = `
<html><body style="font-family: sans-serif; line-height: 1.6; color: #333;">
  <h2>Cierre de Inscripciones — ${c.nombre}</h2>
  <p>Las inscripciones de este concurso quedaron <strong>cerradas</strong>.</p>
  <p>Se adjunta la <strong>lista de inscritos agrupada por categoría</strong>, en orden de
     inscripción.</p>
  <p style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 12px">
     <strong>⚠️ Este archivo no es el orden de ingreso.</strong> El orden de ingreso definitivo
     —con las pruebas armadas según el reglamento— lo genera y envía la administración de
     ADESCRUZ por separado.</p>
  <h3>Resumen por categoría:</h3>
  <ul>${summaryHtml}</ul>
  <p><strong>Total:</strong> ${inscripciones.length} inscripciones</p>
  <p>Archivo: <code>${filename}</code></p>
  <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
  <p style="font-size:12px;color:#666;">Email automático — ADESCRUZ</p>
</body></html>`;

  const sent = await sendEmail(
    recipients,
    `Cierre de Inscripciones — ${c.nombre} — Lista de Inscritos`,
    emailBody,
    excelBase64,
    filename,
  );

  if (sent) {
    await marcarEmailEnviado(c.id);
    return { ok: true, reason: `closed + emailed ${recipients.length} recipient(s)` };
  }
  // Email falló (error transitorio): NO marcamos cierre_email_enviado_en → el cron reintenta.
  return { ok: false, reason: "email send failed — will retry next tick" };
}

// Marca que el orden de ingreso ya fue manejado (enviado, o sin nada que enviar).
// Mientras esté en NULL y el CDS ya cerró, el cron reintenta el envío.
async function marcarEmailEnviado(id: string): Promise<void> {
  const { error } = await supabase
    .from("campeonatos")
    .update({ cierre_email_enviado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error(`Failed to mark cierre_email_enviado_en for ${id}:`, error);
}

// ─── Main ────────────────────────────────────────────────────

async function runCierre() {
  console.log("cierre-inscripciones tick:", new Date().toISOString());

  // Find pending closures
  const { data: pendientes, error } = await supabase
    .from("campeonatos")
    .select("id, numero, nombre, temporada, cierre_emails")
    .eq("cierre_activo", true)
    .eq("inscripciones_abiertas", true)
    .is("cierre_ejecutado_en", null)
    .lte("cierre_fecha", new Date().toISOString())
    .order("cierre_fecha", { ascending: true });

  if (error) {
    console.error("Failed to query pending closures:", error);
    return { processed: 0, error: error.message };
  }

  const results = [];
  const processedIds = new Set<string>();

  // A) Cierres nuevos: cerrar inscripciones + mandar el orden de ingreso
  for (const c of (pendientes || []) as Campeonato[]) {
    processedIds.add(c.id);
    try {
      const r = await processCampeonato(c);
      results.push({ id: c.id, nombre: c.nombre, ...r });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Exception processing ${c.nombre}:`, e);
      results.push({ id: c.id, nombre: c.nombre, ok: false, reason: `exception: ${msg}` });
    }
  }

  // B) Reintentos: CDS ya cerrados cuyo email de orden de ingreso aún no salió
  //    (ej. Resend falló en un tick anterior). Re-cerrar es idempotente.
  const { data: reintentos, error: reErr } = await supabase
    .from("campeonatos")
    .select("id, numero, nombre, temporada, cierre_emails")
    .not("cierre_ejecutado_en", "is", null)
    .is("cierre_email_enviado_en", null)
    .eq("cierre_activo", true);
  if (reErr) console.error("Failed to query email retries:", reErr);
  for (const c of (reintentos || []) as Campeonato[]) {
    if (processedIds.has(c.id)) continue;  // ya intentado en este tick
    try {
      const r = await processCampeonato(c);
      results.push({ id: c.id, nombre: c.nombre, retry: true, ...r });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Exception retrying ${c.nombre}:`, e);
      results.push({ id: c.id, nombre: c.nombre, retry: true, ok: false, reason: `exception: ${msg}` });
    }
  }

  return { processed: results.length, results };
}

serve(async (_req) => {
  const result = await runCierre();
  return new Response(JSON.stringify(result, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
