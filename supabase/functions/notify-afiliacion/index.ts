// ============================================================
// Edge Function: notify-afiliacion
// Disparada por DB webhook al INSERT en `afiliaciones`.
// Lee tarifas_afiliacion + afiliacion_caballos para mostrar el
// desglose REAL del costo (FC=0, compartido=0, normal=210).
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

interface AfiliacionRecord {
  id: string
  temporada: string | number
  nombre: string
  email: string
  celular: string
  club: string
  categoria_id: number | null
  comprobante_url: string | null
  estado: string
  created_at: string
  monto_esperado?: number | null
  total_pago?: number | null
}

interface CaballoRow {
  nombre_caballo: string
  categoria_id: number
  costo_aplicado: number
  afiliacion_compartida_id: string | null
  categorias?: { nombre: string }
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const ADMIN_EMAIL = 'daniel.roca.s@gmail.com'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const payload = await req.json()
    const record: AfiliacionRecord = payload?.record
    if (!record) return new Response('Invalid payload', { status: 400 })

    // Cargar caballos + tarifas con service role
    const supaUrl = Deno.env.get('SUPABASE_URL')!
    const supaKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(supaUrl, supaKey)

    const { data: caballos } = await sb
      .from('afiliacion_caballos')
      .select('nombre_caballo, categoria_id, costo_aplicado, afiliacion_compartida_id, categorias(nombre)')
      .eq('afiliacion_id', record.id)

    const { data: tarifas } = await sb
      .from('tarifas_afiliacion')
      .select('costo_jinete, costo_caballo')
      .eq('temporada', Number(record.temporada) || 2026)
      .single()

    const lista: CaballoRow[] = caballos || []
    const costoJineteTarifa = Number(tarifas?.costo_jinete ?? 500)

    // Detectar si jinete cobra (tiene al menos 1 caballo no-FC con costo > 0 o normal)
    // Usamos costo_aplicado para inferir: si ningún caballo tiene costo > 0 ni hay caballos no-FC, jinete=0.
    const tieneAlgunCobrable = lista.some(c => c.costo_aplicado > 0)
    const costoJinete = tieneAlgunCobrable ? costoJineteTarifa : 0
    const totalCaballos = lista.reduce((s, c) => s + Number(c.costo_aplicado || 0), 0)
    const total = Number(record.monto_esperado ?? record.total_pago ?? (costoJinete + totalCaballos))

    const emailToJinete = await sendEmailViaResend({
      to: record.email,
      subject: `Afiliación recibida — ADESCRUZ Temporada ${record.temporada}`,
      html: jineteHtml(record, lista, costoJinete, total),
    })
    if (!emailToJinete) return new Response('Failed to send email to jinete', { status: 500 })

    const emailToAdmin = await sendEmailViaResend({
      to: ADMIN_EMAIL,
      subject: `[ADMIN] Nueva afiliación — ${record.nombre}`,
      html: adminHtml(record, lista, costoJinete, total),
    })
    if (!emailToAdmin) return new Response('Failed to send email to admin', { status: 500 })

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }, status: 200,
    })
  } catch (error) {
    console.error('notify-afiliacion error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' }, status: 500,
    })
  }
})

async function sendEmailViaResend({ to, subject, html }: { to: string; subject: string; html: string }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: 'no-reply@adescruz.com', to, subject, html }),
  })
  return response.ok
}

// Construye una fila <tr> por caballo con su costo (gratis FC, gratis compartido, o Bs. N)
function caballosRowsHtml(caballos: CaballoRow[]): string {
  if (caballos.length === 0) return ''
  return caballos.map(c => {
    const cat = c.categorias?.nombre || 'Sin categoría'
    let costoLabel = ''
    if (Number(c.costo_aplicado) === 0) {
      // Distinguir FC vs compartido
      costoLabel = c.afiliacion_compartida_id
        ? '<span style="color:#15803d">Bs. 0 (compartido)</span>'
        : '<span style="color:#15803d">Bs. 0 (FC gratis)</span>'
    } else {
      costoLabel = `Bs. ${Number(c.costo_aplicado).toFixed(0)}`
    }
    return `
      <tr>
        <td style="padding:8px 12px;color:#6b7280;font-size:13px">🐴 ${c.nombre_caballo} <span style="color:#9ca3af;font-size:11px">— ${cat}</span></td>
        <td style="padding:8px 12px;color:#111827;font-size:13px;text-align:right;font-weight:600">${costoLabel}</td>
      </tr>`
  }).join('')
}

function jineteHtml(record: AfiliacionRecord, caballos: CaballoRow[], costoJinete: number, total: number): string {
  const cabRows = caballosRowsHtml(caballos)
  const jineteRow = costoJinete > 0
    ? `<tr><td style="padding:8px 12px;color:#6b7280;font-size:13px">Afiliación jinete:</td><td style="padding:8px 12px;color:#111827;font-size:13px;text-align:right;font-weight:600">Bs. ${costoJinete}</td></tr>`
    : `<tr><td style="padding:8px 12px;color:#15803d;font-size:13px">Afiliación jinete (FC):</td><td style="padding:8px 12px;color:#15803d;font-size:13px;text-align:right;font-weight:600">Bs. 0</td></tr>`

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Afiliación recibida</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f0f7f4;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #1a4731 60%, #2d6a4f); padding: 32px 24px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">🐴</div>
      <h1 style="margin: 0; color: #fff; font-size: 24px; font-weight: 700;">Afiliación recibida</h1>
      <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">ADESCRUZ Temporada ${record.temporada}</p>
    </div>
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 24px 0; color: #111827; font-size: 16px;">Hola <strong>${record.nombre}</strong>,</p>
      <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
        Recibimos su solicitud de afiliación para la temporada <strong>${record.temporada}</strong>. Su registro está siendo procesado.
      </p>
      <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
        Un administrador revisará su solicitud y comprobante dentro de los próximos días. Le notificaremos por correo electrónico una vez que su afiliación haya sido confirmada.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; font-weight: 600;">Nombre:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">${record.nombre}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; font-weight: 600;">Club:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">${record.club}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #6b7280; font-size: 13px; font-weight: 600;">Estado:</td>
          <td style="padding: 10px 0; color: #1a4731; font-size: 14px; text-align: right; font-weight: 600;">Pendiente de revisión</td>
        </tr>
      </table>

      <!-- Desglose -->
      <div style="margin: 24px 0;">
        <div style="font-size:12px;font-weight:700;color:#1a4731;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Desglose del costo</div>
        <table style="width: 100%; border-collapse: collapse; background: #f0f7f4; border: 1px solid #d1e7e0; border-radius: 8px; overflow: hidden;">
          ${jineteRow}
          ${cabRows}
          <tr style="border-top: 2px solid #1a4731; background:#fff;">
            <td style="padding: 10px 12px; color: #1a4731; font-size: 14px; font-weight: 700;">Total:</td>
            <td style="padding: 10px 12px; color: #1a4731; font-size: 16px; text-align: right; font-weight: 700;">Bs. ${total}</td>
          </tr>
        </table>
      </div>

      <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
        Si no recibe futuros correos, revise su carpeta de spam y agregue <strong>no-reply@adescruz.com</strong> a sus contactos.
      </p>
      <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
        Si tiene dudas o necesita actualizar su información, contáctenos a través del sitio web de ADESCRUZ.
      </p>
    </div>
    <div style="background: #f0f7f4; padding: 20px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #6b7280; font-size: 12px;">
        ADESCRUZ — Asociación de Deportes Ecuestres de Santa Cruz<br>
        Santa Cruz de la Sierra, Bolivia<br>
        <a href="https://adescruz.com" style="color: #1a4731; text-decoration: none; font-weight: 600;">adescruz.com</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

function adminHtml(record: AfiliacionRecord, caballos: CaballoRow[], costoJinete: number, total: number): string {
  const estadoColor = record.estado === 'pendiente' ? '#f59e0b' : record.estado === 'aprobada' ? '#10b981' : record.estado === 'rechazada' ? '#dc2626' : '#f59e0b'
  const cabRows = caballosRowsHtml(caballos)

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Nueva afiliación</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f0f7f4;">
  <div style="max-width: 700px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #1a4731 60%, #2d6a4f); padding: 32px 24px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">🐴</div>
      <h1 style="margin: 0; color: #fff; font-size: 24px; font-weight: 700;">[ADMIN] Nueva afiliación</h1>
      <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Requiere revisión</p>
    </div>
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 24px 0; color: #111827; font-size: 14px;">
        <strong>Nueva solicitud de afiliación recibida</strong> — Temporada ${record.temporada}
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 8px; overflow: hidden;">
        <tr><td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">ID:</td><td style="padding: 12px 16px; color: #111827; font-size: 12px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">${record.id}</td></tr>
        <tr><td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Nombre:</td><td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${record.nombre}</td></tr>
        <tr><td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Email:</td><td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;"><a href="mailto:${record.email}" style="color: #1a4731;">${record.email}</a></td></tr>
        <tr><td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Celular:</td><td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${record.celular}</td></tr>
        <tr><td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Club:</td><td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${record.club}</td></tr>
        <tr><td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Comprobante:</td><td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${record.comprobante_url ? '✅ Adjunto' : '❌ No adjunto'}</td></tr>
        <tr><td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Estado:</td><td style="padding: 12px 16px; color: #fff; font-size: 13px; border-bottom: 1px solid #e5e7eb; background: ${estadoColor}; font-weight: 600;">${record.estado}</td></tr>
        <tr><td style="padding: 12px 16px; color: #6b7280; font-size: 13px;">Fecha:</td><td style="padding: 12px 16px; color: #111827; font-size: 13px;">${new Date(record.created_at).toLocaleString('es-BO')}</td></tr>
      </table>

      <div style="margin: 24px 0;">
        <div style="font-size:12px;font-weight:700;color:#1a4731;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Desglose del costo</div>
        <table style="width: 100%; border-collapse: collapse; background: #f0f7f4; border: 1px solid #d1e7e0; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding:8px 12px;color:#6b7280;font-size:13px">Afiliación jinete:</td>
            <td style="padding:8px 12px;color:#111827;font-size:13px;text-align:right;font-weight:600">Bs. ${costoJinete}</td>
          </tr>
          ${cabRows}
          <tr style="border-top: 2px solid #1a4731; background:#fff;">
            <td style="padding: 10px 12px; color: #1a4731; font-size: 14px; font-weight: 700;">Total:</td>
            <td style="padding: 10px 12px; color: #1a4731; font-size: 16px; text-align: right; font-weight: 700;">Bs. ${total}</td>
          </tr>
        </table>
      </div>

      <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 13px;">
        Accede al panel de administración para revisar y procesar esta afiliación.
      </p>
    </div>
    <div style="background: #f0f7f4; padding: 20px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #6b7280; font-size: 12px;">
        ADESCRUZ Admin — Notificación automática<br>
        <a href="https://adescruz.com/admin" style="color: #1a4731; text-decoration: none; font-weight: 600;">Panel de administración</a>
      </p>
    </div>
  </div>
</body>
</html>`
}
