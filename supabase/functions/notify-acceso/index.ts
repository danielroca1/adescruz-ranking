import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

interface SolicitudAccesoPayload {
  record: {
    id: string
    nombre: string
    email: string
    rol: string
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
    const payload: SolicitudAccesoPayload = await req.json()
    const { record } = payload

    if (!record) {
      return new Response('Invalid payload', { status: 400 })
    }

    // Email to admin — notification with access request details
    const emailToAdmin = await sendEmailViaResend({
      to: ADMIN_EMAIL,
      subject: `[ADMIN] Solicitud de acceso — ${record.nombre}`,
      html: generateAccesoAdminNotificationEmail(record),
    })

    if (!emailToAdmin) {
      return new Response('Failed to send email to admin', { status: 500 })
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error in notify-acceso:', error)
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

function generateAccesoAdminNotificationEmail(record: any) {
  const rolEmoji = {
    jurado: '⚖️',
    admin: '👨‍💼',
    jinete: '🏇',
  }[record.rol] || '👤'

  const rolColor = {
    jurado: '#8b5cf6',
    admin: '#ef4444',
    jinete: '#3b82f6',
  }[record.rol] || '#6b7280'

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solicitud de acceso</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f0f7f4;">
  <div style="max-width: 700px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a4731 60%, #2d6a4f); padding: 32px 24px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">${rolEmoji}</div>
      <h1 style="margin: 0; color: #fff; font-size: 24px; font-weight: 700;">[ADMIN] Solicitud de acceso</h1>
      <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Nuevo usuario solicita acceso</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 24px 0; color: #111827; font-size: 14px;">
        <strong>Nueva solicitud de acceso recibida</strong>
      </p>

      <!-- Details table -->
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 8px; overflow: hidden;">
        <tr style="background: #f3f4f6;">
          <td style="padding: 12px 16px; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb;">Campo</td>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb;">Valor</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">ID Solicitud:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">${record.id}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Nombre:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${record.nombre}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Email:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;"><a href="mailto:${record.email}" style="color: #1a4731; text-decoration: none; font-weight: 500;">${record.email}</a></td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Rol solicitado:</td>
          <td style="padding: 12px 16px; color: #fff; font-size: 13px; border-bottom: 1px solid #e5e7eb; background: ${rolColor}; font-weight: 600; border-radius: 4px; padding: 8px 12px;">${capitalizeRole(record.rol)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Estado:</td>
          <td style="padding: 12px 16px; color: #f59e0b; font-size: 13px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Pendiente</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px;">Fecha:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px;">${new Date(record.created_at).toLocaleString('es-BO')}</td>
        </tr>
      </table>

      <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
        Revisa esta solicitud en el panel de administración e<br>
        <strong>aprueba</strong> o <strong>rechaza</strong> el acceso según corresponda.
      </p>

      <!-- Action button -->
      <div style="text-align: center; margin: 24px 0;">
        <a href="https://adescruz.com/admin/solicitudes-acceso" style="display: inline-block; background: #1a4731; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
          Ver en panel de admin
        </a>
      </div>
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

function capitalizeRole(rol: string): string {
  return {
    jurado: 'Jurado',
    admin: 'Administrador',
    jinete: 'Jinete',
  }[rol] || rol
}
