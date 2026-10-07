// Edge Function: cierre-inscripciones
// Per-CDS auto-close. Polled by pg_cron every 5 minutes.
//
// Flow:
//   1. SELECT campeonatos WHERE cierre_activo AND cierre_ejecutado_en IS NULL
//      AND cierre_fecha <= NOW() AND inscripciones_abiertas
//   2. For each matching CDS:
//      a. Reserve the close atomically (reservar_cierre_inscripciones): marks it
//         closed (inscripciones_abiertas=false, cierre_ejecutado_en=NOW())
//      b. Generate and SAVE the official entry order (ordenes_ingreso + bucket
//         ordenes-ingreso) with _shared/orden-ingreso.js — the same code the
//         admin uses when closing by hand (7-oct-2026)
//      c. Email the saved files (Saturday and Sunday) to cierre_emails
//
// Idempotent: cierre_ejecutado_en gates re-runs; an email retry re-sends the
// version already saved, it does not generate a new one.
//
// POST { "simular": "<concurso_id>" } with an admin session (or the service key)
// builds the order and the Excel files for that CDS WITHOUT closing, saving or
// emailing anything: it is how a deploy is checked against real data.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import XLSXmod from "npm:xlsx-js-style@1.2.0";
import { encodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";
import * as OI from "../_shared/orden-ingreso.js";
import { esServicioOAdmin } from "../_shared/acceso.ts";

// xlsx-js-style y no `npm:xlsx`: SheetJS community IGNORA los estilos en silencio
// (por eso el Excel de antes salía sin formato).
// deno-lint-ignore no-explicit-any
const XLSX: any = (XLSXmod as any)?.utils ? XLSXmod : (XLSXmod as any).default;

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
  fecha_sab: string | null;
  fecha_dom: string | null;
  cierre_emails: string | null;
}

const CAMPEONATO_COLS = "id, numero, nombre, temporada, fecha_sab, fecha_dom, cierre_emails";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// ─── Email ───────────────────────────────────────────────────

async function sendEmail(
  to: string[],
  subject: string,
  htmlBody: string,
  adjuntos: { filename: string; content: string }[],
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
        attachments: adjuntos.map((a) => ({ ...a, content_type: XLSX_MIME })),
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

// cat_concurso y los nombres los escribe el formulario público: se escapan (24-sep-2026).
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (ch) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string));

// deno-lint-ignore no-explicit-any
function cuerpoCorreo(c: Campeonato, version: number, orden: any): string {
  const dias = (["sab", "dom"] as const).filter((d) => orden.dias[d].pruebas.length || orden.dias[d].sinClasificar.length);
  const resumen = dias.map((d) => {
    // deno-lint-ignore no-explicit-any
    const lis = orden.dias[d].pruebas.map((p: any) =>
      `<li><strong>${esc(p.num)}</strong> — ${p.filas.length} binomio${p.filas.length === 1 ? "" : "s"}</li>`).join("");
    return `<h3>${d === "sab" ? "Sábado" : "Domingo"}</h3><ul>${lis}</ul>`;
  }).join("");
  const avisos: string[] = [];
  for (const d of dias) {
    // deno-lint-ignore no-explicit-any
    orden.dias[d].pruebas.forEach((p: any) => p.avisos.forEach((a: string) => avisos.push(`${d === "sab" ? "Sáb" : "Dom"} · ${p.num}: ${a}`)));
    // deno-lint-ignore no-explicit-any
    orden.dias[d].sinClasificar.forEach((f: any) => avisos.push(`${d === "sab" ? "Sáb" : "Dom"} · SIN CLASIFICAR: ${f.nombre} (${f.cat})`));
  }
  return `
<html><body style="font-family: sans-serif; line-height: 1.6; color: #333;">
  <h2>Cierre de Inscripciones — ${esc(c.nombre)}</h2>
  <p>Las inscripciones de este concurso quedaron <strong>cerradas</strong>.</p>
  <p>Se adjunta el <strong>orden de ingreso oficial</strong> (versión ${version}), generado y
     guardado en el momento del cierre: un archivo por día, con las filas C / B / A arriba de
     cada prueba para las inscripciones de último momento.</p>
  ${resumen}
  ${avisos.length ? `<p style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 12px"><strong>⚠️ Avisos:</strong><br>${avisos.map(esc).join("<br>")}</p>` : ""}
  <p><strong>Total:</strong> ${orden.inscripciones} inscripciones (todas menos las rechazadas)</p>
  <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
  <p style="font-size:12px;color:#666;">Email automático — ADESCRUZ</p>
</body></html>`;
}

// ─── Per-CDS processor ───────────────────────────────────────

async function processCampeonato(c: Campeonato, esReintento = false): Promise<{ ok: boolean; reason: string }> {
  const concursoId = buildConcursoId(c.numero, c.temporada);
  console.log(`Processing ${c.nombre} (concurso_id=${concursoId})`);

  // 1) Mark closed FIRST. If we crash mid-flight at least registrations
  //    won't keep coming in. cierre_ejecutado_en gates re-runs.
  //
  // 24-sep-2026: con una RESERVA atómica (reservar_cierre_inscripciones). La
  // función no pide sesión y la hora del cierre es pública: N llamadas a la vez
  // pasaban todas el SELECT de pendientes y cada una mandaba el Excel al jurado.
  // Ahora solo UNA llamada gana cada cierre (y cada reintento del correo, que
  // vuelve a quedar libre a los 4 min). Un reintento ya no corre
  // cierre_ejecutado_en: validar-comprobante lo usa como hora real del cierre.
  const { data: reservado, error: updErr } = await supabase
    .rpc("reservar_cierre_inscripciones", { p_id: c.id, p_reintento: esReintento });

  if (updErr) {
    console.error(`Failed to mark CDS ${c.id} as closed:`, updErr);
    return { ok: false, reason: `update failed: ${updErr.message}` };
  }
  if (reservado !== true) {
    return { ok: true, reason: "otra llamada ya lo está procesando" };
  }

  // 2) El orden oficial (7-oct-2026). Filtro PERMISIVO, el de [[orden-de-ingreso]]:
  //    todo menos lo `rechazada` — a la hora del cierre puede haber pagos en
  //    revisión, y esa gente compite. Lo aplica _shared/orden-ingreso.js, igual
  //    que en el admin.
  const inscripciones = await OI.leerInscripciones(supabase, concursoId);
  if (!inscripciones.some(OI.entraAlOrden)) {
    console.log(`No inscriptions for ${concursoId} — closing without email`);
    await marcarEmailEnviado(c.id);  // nada que mandar → no reintentar
    return { ok: true, reason: "no inscriptions, closed silently" };
  }

  // Un reintento del correo manda la versión YA guardada (no genera otra): lo que
  // reciben los jueces tiene que ser lo que quedó guardado al cierre.
  // deno-lint-ignore no-explicit-any
  let guardado: { version: number; archivos: Record<string, string>; orden: any } | null = null;
  if (esReintento) {
    const { data: prev } = await supabase.from("ordenes_ingreso")
      .select("version, archivos, orden").eq("concurso_id", concursoId).eq("origen", "cierre_automatico")
      .order("version", { ascending: false }).limit(1);
    if (prev && prev.length) guardado = prev[0];
  }
  if (!guardado) {
    try {
      guardado = await OI.guardarOrdenOficial({
        sb: supabase, XLSX, origen: "cierre_automatico",
        campeonato: { id: c.id, nombre: c.nombre, fecha_sab: c.fecha_sab, fecha_dom: c.fecha_dom, concurso_id: concursoId },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`No se pudo guardar el orden de ${concursoId}:`, e);
      return { ok: false, reason: `orden de ingreso: ${msg} — se reintenta en el próximo tick` };
    }
  }

  // 3) Recipients (per-CDS). El orden ya quedó guardado aunque no haya a quién mandarlo.
  const recipients = (c.cierre_emails || "")
    .split(",").map((e) => e.trim()).filter((e) => e);
  if (recipients.length === 0) {
    console.warn(`No cierre_emails for ${concursoId} — closed, order saved, no email sent`);
    await marcarEmailEnviado(c.id);  // sin destinatarios → es config, no error transitorio: no reintentar
    return { ok: true, reason: `closed, order v${guardado.version} saved, no recipients configured` };
  }

  // 4) Los archivos guardados, tal cual, como adjuntos.
  const adjuntos: { filename: string; content: string }[] = [];
  for (const dia of ["sab", "dom"]) {
    const ruta = guardado.archivos?.[dia];
    if (!ruta) continue;
    const { data: blob, error: dlErr } = await supabase.storage.from("ordenes-ingreso").download(ruta);
    if (dlErr || !blob) return { ok: false, reason: `no se pudo leer ${ruta}: ${dlErr?.message} — se reintenta` };
    adjuntos.push({ filename: ruta.split("/").pop()!, content: encodeBase64(new Uint8Array(await blob.arrayBuffer())) });
  }

  const sent = await sendEmail(
    recipients,
    `Cierre de Inscripciones — ${c.nombre} — Orden de Ingreso (v${guardado.version})`,
    cuerpoCorreo(c, guardado.version, guardado.orden),
    adjuntos,
  );

  if (sent) {
    await marcarEmailEnviado(c.id);
    return { ok: true, reason: `closed + order v${guardado.version} saved + emailed ${recipients.length} recipient(s)` };
  }
  // Email falló (error transitorio): NO marcamos cierre_email_enviado_en → el cron reintenta.
  return { ok: false, reason: "email send failed — will retry next tick" };
}

// Marca que el orden de ingreso ya fue manejado (enviado, o sin nada que enviar).
// Mientras esté en NULL y el CDS ya cerró, el cron reintenta el envío.
async function marcarEmailEnviado(id: number): Promise<void> {
  const { error } = await supabase
    .from("campeonatos")
    .update({ cierre_email_enviado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error(`Failed to mark cierre_email_enviado_en for ${id}:`, error);
}

// ─── Simulación (solo admin / clave de servicio) ─────────────

async function simular(concursoId: string) {
  const inscripciones = await OI.leerInscripciones(supabase, concursoId);
  const orden = OI.generarOrdenConcurso(inscripciones);
  const bytes: Record<string, number> = {};
  for (const dia of ["sab", "dom"] as const) {
    const d = orden.dias[dia];
    if (!d.pruebas.length && !d.sinClasificar.length) continue;
    const wb = OI.libroOrdenDia(XLSX, { titulo: `SIMULACIÓN — ${concursoId} — ${OI.DIA_TXT[dia]}`, subtitulo: "simulación: no se guardó ni se mandó nada", dia: d });
    const datos = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    bytes[dia] = datos.byteLength ?? datos.length;
  }
  return { simulado: true, algoritmo: OI.ORDEN_INGRESO_VERSION, concurso_id: concursoId,
           inscripciones: orden.inscripciones, avisos: OI.contarAvisos(orden), excel_bytes: bytes, orden };
}

// ─── Main ────────────────────────────────────────────────────

async function runCierre() {
  console.log("cierre-inscripciones tick:", new Date().toISOString());

  // Find pending closures
  const { data: pendientes, error } = await supabase
    .from("campeonatos")
    .select(CAMPEONATO_COLS)
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
  const processedIds = new Set<number>();

  // A) Cierres nuevos: cerrar inscripciones + guardar y mandar el orden de ingreso
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
    .select(CAMPEONATO_COLS)
    .not("cierre_ejecutado_en", "is", null)
    .is("cierre_email_enviado_en", null)
    .eq("cierre_activo", true);
  if (reErr) console.error("Failed to query email retries:", reErr);
  for (const c of (reintentos || []) as Campeonato[]) {
    if (processedIds.has(c.id)) continue;  // ya intentado en este tick
    try {
      const r = await processCampeonato(c, true);
      results.push({ id: c.id, nombre: c.nombre, retry: true, ...r });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Exception retrying ${c.nombre}:`, e);
      results.push({ id: c.id, nombre: c.nombre, retry: true, ok: false, reason: `exception: ${msg}` });
    }
  }

  return { processed: results.length, results };
}

serve(async (req) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body, null, 2), {
    status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*",
                       "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" },
  });
  if (req.method === "OPTIONS") return json({ ok: true });

  // ¿Simulación? Solo con sesión de admin o la clave de servicio.
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) { /* el cron manda {} o nada */ }
  if (typeof body.simular === "string" && body.simular) {
    if (!(await esServicioOAdmin(supabase, req))) return json({ error: "Solo un administrador puede simular" }, 403);
    try { return json(await simular(body.simular)); }
    catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 500); }
  }

  return json(await runCierre());
});
