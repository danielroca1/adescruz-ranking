import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

interface InscripcionPayload {
  record: {
    id: string
    concurso_id: string
    nombre: string
    email: string
    celular: string
    cat_oficial: string
    club: string
    equino: string
    cat_concurso: string
    dias: string
    comprobante_url: string | null
    estado: string
    created_at: string
  }
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const ADMIN_EMAIL = 'daniel.roca.s@gmail.com'

// Todo lo que va al HTML lo escribió el jinete en el formulario público: se
// escapa. Sin esto, un nombre con <a href=…> llegaba como enlace a un correo
// enviado desde no-reply@adescruz.com.
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const DIAS: Record<string, string> = { ambos: 'Sábado y domingo', sabado: 'Sábado', domingo: 'Domingo' }
const diasTxt = (d: unknown) => DIAS[String(d ?? '').toLowerCase()] ?? String(d ?? '')

// Enlace al listado público de inscritos DE ESE concurso: sin `?cds=` la página
// muestra solo el CDS con inscripciones abiertas, y después del cierre el
// jinete no se encontraría.
function urlInscritos(concursoId: unknown): string {
  const romano = String(concursoId ?? '').split('-')[0].toUpperCase()
  const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 }
  let n = 0
  for (let i = 0; i < romano.length; i++) {
    const a = v[romano[i]] ?? 0, b = v[romano[i + 1]] ?? 0
    n += a < b ? -a : a
  }
  return n > 0 && n < 100 ? `https://adescruz.com/inscritos?cds=${n}` : 'https://adescruz.com/inscritos'
}

function bytesABase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

// ── El comprobante, adjunto a los dos correos ────────────────────────────────
// Pedido de Daniel (18-sep-2026). El formulario sube el archivo ANTES de crear
// la inscripción, así que `comprobante_url` ya viene en el payload del webhook.
// Si no se puede bajar, el correo sale igual sin adjunto: un adjunto nunca
// frena el aviso de que alguien se inscribió.
async function adjuntoComprobante(record: any): Promise<{ filename: string; content: string } | null> {
  const ruta = record?.comprobante_url
  if (!ruta) return null
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data, error } = await sb.storage.from('comprobantes').download(ruta)
    if (error || !data) { console.error('No se pudo bajar el comprobante', ruta, error?.message); return null }
    const bytes = new Uint8Array(await data.arrayBuffer())
    if (bytes.length > 10 * 1024 * 1024) return null
    const ext = (String(ruta).split('.').pop() || 'jpg').toLowerCase()
    const quien = String(record.nombre || 'jinete').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
    return { filename: `Comprobante_${quien}_${record.concurso_id || 'CDS'}.${ext}`, content: bytesABase64(bytes) }
  } catch (e) {
    console.error('Error adjuntando el comprobante:', e)
    return null
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const payload: InscripcionPayload = await req.json()
    const { record } = payload

    if (!record) {
      return new Response('Invalid payload', { status: 400 })
    }

    const adjunto = await adjuntoComprobante(record)
    const attachments = adjunto ? [adjunto] : undefined

    // Email 1: To jinete — confirmation receipt
    // NOTE: inscripciones table must have email field — celular is phone only
    const emailToJinete = await sendEmailViaResend({
      to: record.email, // FIXED: Use email field, not celular (phone number)
      subject: `Inscripción recibida — CDS ${record.concurso_id}`,
      html: generateInscripcionConfirmationEmail(record, !!adjunto),
      attachments,
    })

    if (!emailToJinete) {
      return new Response('Failed to send email to jinete', { status: 500 })
    }

    // Email 2: To admin — notification with full details
    const emailToAdmin = await sendEmailViaResend({
      to: ADMIN_EMAIL,
      subject: `[ADMIN] Nueva inscripción — ${record.nombre} (${record.concurso_id})`,
      html: generateInscripcionAdminNotificationEmail(record, !!adjunto),
      attachments,
    })

    if (!emailToAdmin) {
      return new Response('Failed to send email to admin', { status: 500 })
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Emails sent successfully' }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error in notify-inscripcion:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function sendEmailViaResend({
  to,
  subject,
  html,
  attachments,
}: {
  to: string
  subject: string
  html: string
  attachments?: Array<{ filename: string; content: string }>
}) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'no-reply@adescruz.com',
      to,
      subject,
      html,
      ...(attachments ? { attachments } : {}),
    }),
  })
  if (!response.ok) console.error('Resend', response.status, await response.text())
  return response.ok
}

function generateInscripcionConfirmationEmail(record: any, conAdjunto = false) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inscripción recibida</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f0f7f4;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a4731 60%, #2d6a4f); padding: 32px 24px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">🏆</div>
      <h1 style="margin: 0; color: #fff; font-size: 24px; font-weight: 700;">Inscripción recibida</h1>
      <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">CDS ${record.concurso_id}</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 24px 0; color: #111827; font-size: 16px;">
        Hola <strong>${esc(record.nombre)}</strong>,
      </p>

      <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
        Recibimos su inscripción para el <strong>CDS ${record.concurso_id}</strong>. Su registro está siendo procesado.
      </p>

      <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
        Un administrador verificará su comprobante de pago. Una vez confirmado, su inscripción aparecerá en el listado de inscritos del concurso:
        <a href="${urlInscritos(record.concurso_id)}" style="color: #1a4731; font-weight: 600;">adescruz.com/inscritos</a>
      </p>

      <!-- Details table -->
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; font-weight: 600;">Jinete:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">${esc(record.nombre)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; font-weight: 600;">Club:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">${esc(record.club)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; font-weight: 600;">Equino:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">${esc(record.equino)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; font-weight: 600;">Categoría inscrita:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">${esc(record.cat_concurso)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; font-weight: 600;">Categoría oficial:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">${esc(record.cat_oficial)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; ${conAdjunto ? 'border-bottom: 1px solid #e5e7eb; ' : ''}color: #6b7280; font-size: 13px; font-weight: 600;">Días:</td>
          <td style="padding: 10px 0; ${conAdjunto ? 'border-bottom: 1px solid #e5e7eb; ' : ''}color: #1a4731; font-size: 14px; text-align: right; font-weight: 600;">${esc(diasTxt(record.dias))}</td>
        </tr>${conAdjunto ? `
        <tr>
          <td style="padding: 10px 0; color: #6b7280; font-size: 13px; font-weight: 600;">Comprobante:</td>
          <td style="padding: 10px 0; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">📎 Adjunto a este correo</td>
        </tr>` : ''}
      </table>

      <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
        Si tiene dudas o necesita actualizar su información, contáctenos a través del sitio web de ADESCRUZ.
      </p>
    </div>

    <!-- Footer -->
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

function generateInscripcionAdminNotificationEmail(record: any, conAdjunto = false) {
  const estadoColor = record.estado === 'pendiente' ? '#f59e0b' : '#10b981'
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nueva inscripción</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f0f7f4;">
  <div style="max-width: 700px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a4731 60%, #2d6a4f); padding: 32px 24px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">🏆</div>
      <h1 style="margin: 0; color: #fff; font-size: 24px; font-weight: 700;">[ADMIN] Nueva inscripción</h1>
      <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Requiere revisión de pago</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 24px 0; color: #111827; font-size: 14px;">
        <strong>Nueva inscripción recibida</strong> — CDS ${esc(record.concurso_id)}
      </p>

      <!-- Details table -->
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 8px; overflow: hidden;">
        <tr style="background: #f3f4f6;">
          <td style="padding: 12px 16px; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb;">Campo</td>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb;">Valor</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">ID Registro:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">${esc(record.id)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Nombre:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${esc(record.nombre)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Celular:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${esc(record.celular)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Categoría oficial:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${esc(record.cat_oficial)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Club:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${esc(record.club)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Equino:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${esc(record.equino)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Categoría inscrita:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${esc(record.cat_concurso)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Días:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${esc(diasTxt(record.dias))}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Comprobante:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${conAdjunto ? '📎 Adjunto a este correo' : record.comprobante_url ? '⚠️ No se pudo adjuntar: verlo en el admin' : '❌ No subió comprobante'}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Estado:</td>
          <td style="padding: 12px 16px; color: #fff; font-size: 13px; border-bottom: 1px solid #e5e7eb; background: ${estadoColor}; font-weight: 600; border-radius: 4px;">${record.estado}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px;">Fecha:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px;">${new Date(record.created_at).toLocaleString('es-BO')}</td>
        </tr>
      </table>

      <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 13px;">
        Accede al panel de administración para revisar y confirmar el pago de esta inscripción.
      </p>
    </div>

    <!-- Footer -->
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
