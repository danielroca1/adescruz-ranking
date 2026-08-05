import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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

    // Email 1: To jinete — confirmation receipt
    // NOTE: inscripciones table must have email field — celular is phone only
    const emailToJinete = await sendEmailViaResend({
      to: record.email, // FIXED: Use email field, not celular (phone number)
      subject: `Inscripción recibida — CDS ${record.concurso_id}`,
      html: generateInscripcionConfirmationEmail(record),
    })

    if (!emailToJinete) {
      return new Response('Failed to send email to jinete', { status: 500 })
    }

    // Email 2: To admin — notification with full details
    const emailToAdmin = await sendEmailViaResend({
      to: ADMIN_EMAIL,
      subject: `[ADMIN] Nueva inscripción — ${record.nombre} (${record.concurso_id})`,
      html: generateInscripcionAdminNotificationEmail(record),
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
}: {
  to: string
  subject: string
  html: string
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
    }),
  })

  return response.ok
}

function generateInscripcionConfirmationEmail(record: any) {
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
        Hola <strong>${record.nombre}</strong>,
      </p>

      <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
        Recibimos tu inscripción para el <strong>CDS ${record.concurso_id}</strong>. Tu registro está siendo procesado.
      </p>

      <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
        Un administrador verificará tu comprobante de pago dentro de los próximos días. Te notificaremos por correo electrónico una vez que tu inscripción haya sido confirmada.
      </p>

      <!-- Details table -->
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; font-weight: 600;">Jinete:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">${record.nombre}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; font-weight: 600;">Club:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">${record.club}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; font-weight: 600;">Equino:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">${record.equino}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; font-weight: 600;">Categoría:</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">${record.cat_concurso}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #6b7280; font-size: 13px; font-weight: 600;">Participación:</td>
          <td style="padding: 10px 0; color: #1a4731; font-size: 14px; text-align: right; font-weight: 600;">${record.dias}</td>
        </tr>
      </table>

      <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
        Si tienes dudas o necesitas actualizar tu información, contáctanos a través del sitio web de ADESCRUZ.
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

function generateInscripcionAdminNotificationEmail(record: any) {
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
        <strong>Nueva inscripción recibida</strong> — CDS ${record.concurso_id}
      </p>

      <!-- Details table -->
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 8px; overflow: hidden;">
        <tr style="background: #f3f4f6;">
          <td style="padding: 12px 16px; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb;">Campo</td>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb;">Valor</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">ID Registro:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">${record.id}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Nombre:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${record.nombre}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Celular:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${record.celular}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Categoría oficial:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${record.cat_oficial}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Club:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${record.club}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Equino:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${record.equino}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Categoría CDS:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${record.cat_concurso}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Días:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${record.dias}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Comprobante:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${record.comprobante_url ? '✅ Adjunto' : '❌ No adjunto'}</td>
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
