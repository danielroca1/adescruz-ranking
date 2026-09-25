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
// Adónde mandan el comprobante de afiliación (Daniel, 22-sep-2026: «pone mi
// número de teléfono de cobranzas para que lo manden ahí»).
const WHATSAPP_COBRANZAS = '75673220'

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

// ── El comprobante, adjunto al correo [ADMIN] ─────────────────────────────────
// Pedido de Daniel (18-sep-2026): el comprobante en los dos correos. Desde el
// 24-sep-2026 va SOLO en el [ADMIN]: el formulario es público, el archivo lo sube
// quien se inscribe y la dirección también la escribe él, así que adjuntarlo al
// correo «del jinete» dejaba mandar cualquier PDF desde adescruz.com a cualquier
// dirección. El jinete ya tiene su comprobante (lo acaba de subir).
// El tipo se decide por los primeros bytes, no por la extensión (un .jfif o una
// foto sin extensión de Android también son JPEG). Si no se puede bajar o no es
// imagen ni PDF, el correo sale igual sin adjunto.
const TIPOS: Array<{ ext: string; mime: string; es: (b: Uint8Array) => boolean }> = [
  { ext: 'pdf',  mime: 'application/pdf', es: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  { ext: 'jpg',  mime: 'image/jpeg',      es: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png',  mime: 'image/png',       es: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: 'gif',  mime: 'image/gif',       es: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  { ext: 'webp', mime: 'image/webp',      es: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
                                                     && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  { ext: 'heic', mime: 'image/heic',      es: (b) => String.fromCharCode(...b.subarray(4, 8)) === 'ftyp'
                                                     && ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(String.fromCharCode(...b.subarray(8, 12))) },
]

async function adjuntoComprobante(record: any): Promise<{ filename: string; content: string; mime: string } | null> {
  const ruta = record?.comprobante_url
  if (!ruta) return null
  // Solo el archivo de la propia inscripción (la base exige que sea una subida de
  // los últimos 30 min que nadie más usa).
  if (!/^inscripciones\/[^/]+$/.test(String(ruta))) return null
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data, error } = await sb.storage.from('comprobantes').download(ruta)
    if (error || !data) { console.error('No se pudo bajar el comprobante', ruta, error?.message); return null }
    const bytes = new Uint8Array(await data.arrayBuffer())
    if (bytes.length > 10 * 1024 * 1024) return null
    const tipo = TIPOS.find((t) => t.es(bytes))
    if (!tipo) { console.error('El comprobante no es imagen ni PDF', ruta); return null }
    const quien = String(record.nombre || 'jinete').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
    return { filename: `Comprobante_${quien}_${record.concurso_id || 'CDS'}.${tipo.ext}`, content: bytesABase64(bytes), mime: tipo.mime }
  } catch (e) {
    console.error('Error adjuntando el comprobante:', e)
    return null
  }
}

// ── Recordatorio de afiliación pendiente, con los QR adjuntos ────────────────
// Pedido de Daniel (21-sep-2026): «en el mail de confirmación, también le llegue
// el recordatorio (breve) de cuánto deben de afiliación y los qr para pagar».
// Decisiones: TODOS los años pendientes (2024 en adelante), QR como imágenes
// adjuntas (las apps de banco leen un QR de la galería, no de un enlace), solo
// cuando hay deuda, y sin indicar qué escribir: el QR ya trae la glosa fija.
// La deuda 2025 es una PROYECCIÓN desde el padrón 2024 (puede reclamarle a quien
// ya pagó): por eso el texto dice «según nuestros registros» y pide el
// comprobante si ya pagó. Una afiliación con comprobante subido está «en
// verificación» y NO se recuerda. Cualquier error acá devuelve null: el correo
// de inscripción sale igual, sin recordatorio.
//
// El jinete se busca por el NOMBRE que se escribe en el formulario público y el
// correo va a la dirección que también se escribe ahí, así que quien pone el
// nombre de otro jinete recibe la deuda de ese jinete. Está bien así: Daniel
// (24-sep-2026) — la deuda no es información confidencial ni delicada, dos
// veces al año se manda un PDF con la deuda de todos.
type Deuda = {
  anios: Array<{ temporada: number; total: number; cuota: number; caballos: Array<{ nombre: string; costo: number }> }>
  total: number
}

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim()
// Formato boliviano: punto para miles, coma para decimales (Bs 1.252,80).
const bs = (n: number) => {
  const [ent, dec] = (Math.round(n * 100) / 100).toFixed(2).split('.')
  return 'Bs ' + ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec
}

async function deudaAfiliacion(record: any): Promise<Deuda | null> {
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    // El jinete se busca por nombre normalizado (sin tildes ni mayúsculas): el
    // formulario autocompleta desde el padrón, y en el XIII+XIV 101 de 103
    // inscripciones coincidían exactas. Si hay 0 o más de 1, no se recuerda nada.
    const { data: jinetes, error: e1 } = await sb.from('jinetes').select('id, nombre')
    if (e1 || !jinetes) return null
    const k = norm(record.nombre)
    const cand = jinetes.filter((j: any) => norm(j.nombre) === k)
    if (cand.length !== 1) return null

    const { data: afs, error: e2 } = await sb.from('afiliaciones')
      .select('temporada, monto_esperado, afiliacion_caballos!afiliacion_caballos_afiliacion_id_fkey(nombre_caballo, costo_aplicado)')
      .eq('jinete_id', cand[0].id).eq('estado', 'pendiente').is('comprobante_url', null)
      .gte('temporada', 2024).order('temporada')
    if (e2 || !afs || !afs.length) return null

    const anios = afs.map((a: any) => {
      const caballos = (a.afiliacion_caballos || [])
        .map((c: any) => ({ nombre: String(c.nombre_caballo || ''), costo: Number(c.costo_aplicado || 0) }))
      const total = Number(a.monto_esperado || 0)
      const cuota = Math.max(0, total - caballos.reduce((s: number, c: any) => s + c.costo, 0))
      return { temporada: Number(a.temporada), total, cuota, caballos }
    }).filter((a: any) => a.total > 0)
    if (!anios.length) return null
    return { anios, total: anios.reduce((s: number, a: any) => s + a.total, 0) }
  } catch (e) {
    console.error('Error calculando la deuda de afiliación:', e)
    return null
  }
}

// Los QR viven en el bucket público `qr-pagos`, en la raíz, con los nombres con
// que los subió Daniel (con espacios y mayúsculas). Uno por gestión pendiente.
// Para el correo se prefiere la versión «con titulo» (franja verde arriba con
// «Afiliación AAAA» en blanco, pedida por Daniel el 22-sep-2026); si no está,
// se manda el QR pelado.
async function adjuntosQr(anios: number[]): Promise<Array<{ filename: string; content: string }>> {
  const out: Array<{ filename: string; content: string }> = []
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    for (const anio of anios) {
      for (const nombre of [`QR Afiliacion ${anio} con titulo.jpeg`, `QR Afiliacion ${anio}.jpeg`, `QR Afiliacion ${anio}.jpg`, `QR Afiliacion ${anio}.png`]) {
        const { data, error } = await sb.storage.from('qr-pagos').download(nombre)
        if (error || !data) continue
        const bytes = new Uint8Array(await data.arrayBuffer())
        if (!bytes.length || bytes.length > 2 * 1024 * 1024) break
        out.push({ filename: `QR_Afiliacion_${anio}.${nombre.split('.').pop()}`, content: bytesABase64(bytes) })
        break
      }
    }
  } catch (e) {
    console.error('Error adjuntando los QR:', e)
  }
  return out
}

function bloqueDeudaJinete(deuda: Deuda, conQr: boolean): string {
  const filas = deuda.anios.map((a) => {
    const detalle = [
      a.cuota > 0 ? `cuota del jinete ${bs(a.cuota)}` : 'cuota del jinete ya cancelada',
      ...a.caballos.map((c) => `${esc(c.nombre)} ${c.costo > 0 ? bs(c.costo) : '(sin costo)'}`),
    ].join(' + ')
    return `<tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #fde68a; color: #92400e; font-size: 13px; font-weight: 600;">Afiliación ${a.temporada}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #fde68a; color: #111827; font-size: 13px; text-align: right;"><strong>${bs(a.total)}</strong><br><span style="color:#6b7280;font-size:11px;">${detalle}</span></td>
        </tr>`
  }).join('')
  return `
      <div style="margin: 28px 0 0 0; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 16px 18px;">
        <p style="margin: 0 0 6px 0; color: #92400e; font-size: 14px; font-weight: 700;">Recordatorio de afiliación</p>
        <p style="margin: 0 0 12px 0; color: #78350f; font-size: 13px; line-height: 1.5;">
          Según nuestros registros, tiene pendiente el pago de la afiliación anual de ADESCRUZ:
        </p>
        <table style="width: 100%; border-collapse: collapse;">${filas}
        <tr>
          <td style="padding: 10px 0 0 0; color: #92400e; font-size: 13px; font-weight: 700;">Total pendiente</td>
          <td style="padding: 10px 0 0 0; color: #92400e; font-size: 15px; text-align: right; font-weight: 700;">${bs(deuda.total)}</td>
        </tr>
        </table>
        <p style="margin: 14px 0 0 0; color: #78350f; font-size: 13px; line-height: 1.5;">
          ${conQr
            ? 'Adjuntamos el QR de cada gestión pendiente: <strong>un pago por gestión</strong>, por el monto indicado. Abra la imagen desde su galería con la app de su banco.'
            : 'Puede pagar desde su perfil en <a href="https://adescruz.com/perfiles" style="color:#92400e;font-weight:600;">adescruz.com/perfiles</a> (Mi perfil → Pagar).'}
          Cuando pague, envíe el comprobante por WhatsApp al <strong>${WHATSAPP_COBRANZAS}</strong> (cobranzas ADESCRUZ)
          o súbalo desde su perfil en <a href="https://adescruz.com/perfiles" style="color:#92400e;font-weight:600;">adescruz.com/perfiles</a>.
          <strong>Si ya pagó, disculpe el aviso</strong> y mándenos el comprobante al mismo WhatsApp para registrarlo.
        </p>
      </div>`
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const payload: InscripcionPayload = await req.json()

    // ── Del pedido solo se usa el id (24-sep-2026) ─────────────────────────────
    // Esta función no pide sesión (la llama el webhook de la base, sin token) y
    // antes usaba el `record` que le mandaran: cualquiera podía mandar correos
    // desde no-reply@adescruz.com a cualquier dirección y adjuntarse el
    // comprobante de otra persona. Ahora: se relee la fila de la base, solo se
    // avisa de inscripciones creadas hace menos de 15 min, y cada una UNA vez
    // (notificaciones_enviadas, que solo toca service_role).
    const id = String(payload?.record?.id ?? '')
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return new Response('Invalid payload', { status: 400 })
    }
    const sbSrv = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: record, error: leerErr } = await sbSrv.from('inscripciones').select('*').eq('id', id).maybeSingle()
    if (leerErr || !record) {
      return new Response('Not found', { status: 404 })
    }
    if (Date.now() - new Date(record.created_at).getTime() > 15 * 60 * 1000) {
      return new Response('Aviso vencido', { status: 409 })
    }
    // Para el tope, la casilla real: sin «+etiqueta» y, en Gmail, sin puntos
    // (victima+1@gmail.com y v.ictima@gmail.com son la misma casilla).
    const destinatario = (() => {
      const [local = '', dominio = ''] = String(record.email ?? '').trim().toLowerCase().split('@')
      const gmail = dominio === 'gmail.com' || dominio === 'googlemail.com'
      const l = local.split('+')[0]
      return `${gmail ? l.replace(/\./g, '') : l}@${gmail ? 'gmail.com' : dominio}`
    })()
    const { error: reclamoErr } = await sbSrv.from('notificaciones_enviadas').insert({ ref_id: id, tipo: 'inscripcion', destinatario })
    if (reclamoErr) {
      if (reclamoErr.code === '23505') {
        return new Response(JSON.stringify({ success: true, skipped: 'ya avisada' }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 })
      }
      // Sin la tabla (o con la base caída) el aviso sale igual: el aviso de una
      // inscripción real no se pierde por un control extra.
      console.error('notificaciones_enviadas:', reclamoErr.message)
    }
    // Si el correo al jinete falla, se libera el reclamo para no perder el aviso.
    const liberarReclamo = () => sbSrv.from('notificaciones_enviadas').delete().eq('ref_id', id).eq('tipo', 'inscripcion')

    // Topes: una familia inscribe varios binomios con el mismo correo, pero nadie
    // legítimo pasa de ~10 en un día; y el pico medido es de 11 inscripciones en
    // una hora (18-sep-2026). Pasado un tope, el correo al jinete no sale (el
    // [ADMIN] sí, y lo dice): el formulario no sirve para mandar correos de
    // adescruz.com en cantidad.
    const TOPE_POR_CORREO_DIA = 10
    const TOPE_TOTAL_HORA = 40
    let sobreTope = ''
    if (!reclamoErr) {
      const desde = (ms: number) => new Date(Date.now() - ms).toISOString()
      const { count: porCorreo } = await sbSrv.from('notificaciones_enviadas').select('ref_id', { count: 'exact', head: true })
        .eq('tipo', 'inscripcion').eq('destinatario', destinatario).gte('enviado_en', desde(24 * 3600 * 1000))
      const { count: total } = await sbSrv.from('notificaciones_enviadas').select('ref_id', { count: 'exact', head: true })
        .eq('tipo', 'inscripcion').gte('enviado_en', desde(3600 * 1000))
      if ((porCorreo ?? 0) > TOPE_POR_CORREO_DIA) sobreTope = `esa dirección ya recibió más de ${TOPE_POR_CORREO_DIA} avisos en 24 h`
      else if ((total ?? 0) > TOPE_TOTAL_HORA) sobreTope = `ya salieron más de ${TOPE_TOTAL_HORA} avisos de inscripción en la última hora`
    }

    const adjunto = await adjuntoComprobante(record)
    const deuda = await deudaAfiliacion(record)
    const qrs = deuda ? await adjuntosQr(deuda.anios.map((a) => a.temporada)) : []
    const bloqueDeuda = deuda ? bloqueDeudaJinete(deuda, qrs.length > 0) : ''

    // Email 1: To jinete — confirmation receipt (+ recordatorio de afiliación si debe).
    // Sin el comprobante adjunto (ver adjuntoComprobante).
    if (!sobreTope) {
      const emailToJinete = await sendEmailViaResend({
        to: record.email,
        subject: `Inscripción recibida — CDS ${record.concurso_id}`,
        html: generateInscripcionConfirmationEmail(record, false, bloqueDeuda),
        attachments: qrs.length ? qrs : undefined,
      })

      if (!emailToJinete) {
        await liberarReclamo()
        return new Response('Failed to send email to jinete', { status: 500 })
      }
    }

    // Email 2: To admin — notification with full details
    const deudaAdmin = (deuda
      ? `Debe afiliación: <strong>${bs(deuda.total)}</strong> (${deuda.anios.map((a) => a.temporada).join(', ')}) — `
        + (sobreTope ? 'no se le recordó (ver abajo)' : `se le recordó en su correo${qrs.length ? ', con ' + qrs.length + ' QR adjunto(s)' : ''}`)
      : 'Sin afiliación pendiente registrada')
      + (sobreTope ? `<br>⚠️ No se le mandó la confirmación: ${sobreTope}` : '')
    // En el [ADMIN] el comprobante va INCRUSTADO en el cuerpo (Daniel, 22-sep-2026:
    // «ahí debe ir el archivo, idealmente en el cuerpo del correo, no como
    // adjunto»): imagen inline por Content-ID. Un PDF no se puede mostrar como
    // imagen: queda adjunto y el correo lo dice.
    const esImagen = !!adjunto && ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(adjunto.mime)
    const adjuntoAdmin = adjunto
      ? (esImagen
          ? { filename: adjunto.filename, content: adjunto.content, content_id: 'comprobante', content_type: adjunto.mime }
          : { filename: adjunto.filename, content: adjunto.content })
      : null
    const emailToAdmin = await sendEmailViaResend({
      to: ADMIN_EMAIL,
      subject: `[ADMIN] Nueva inscripción — ${record.nombre} (${record.concurso_id})`,
      html: generateInscripcionAdminNotificationEmail(record, !!adjunto, deudaAdmin, esImagen),
      attachments: adjuntoAdmin ? [adjuntoAdmin] : undefined,
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
  attachments?: Array<{ filename: string; content: string; content_id?: string; content_type?: string }>
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

function generateInscripcionConfirmationEmail(record: any, conAdjunto = false, bloqueDeuda = '') {
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
      <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">CDS ${esc(record.concurso_id)}</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 24px 0; color: #111827; font-size: 16px;">
        Hola <strong>${esc(record.nombre)}</strong>,
      </p>

      <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
        Recibimos su inscripción para el <strong>CDS ${esc(record.concurso_id)}</strong>. Su registro está siendo procesado.
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
${bloqueDeuda}
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

function generateInscripcionAdminNotificationEmail(record: any, conAdjunto = false, deudaAdmin = '', inline = false) {
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
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${conAdjunto ? (inline ? '🖼 Abajo, en este correo' : '📎 Adjunto a este correo (PDF)') : record.comprobante_url ? '⚠️ No se pudo adjuntar: verlo en el admin' : '❌ No subió comprobante'}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Estado:</td>
          <td style="padding: 12px 16px; color: #fff; font-size: 13px; border-bottom: 1px solid #e5e7eb; background: ${estadoColor}; font-weight: 600; border-radius: 4px;">${esc(record.estado)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; border-bottom: 1px solid #e5e7eb;">Fecha:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px; border-bottom: 1px solid #e5e7eb;">${new Date(record.created_at).toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #6b7280; font-size: 13px;">Afiliación:</td>
          <td style="padding: 12px 16px; color: #111827; font-size: 13px;">${deudaAdmin}</td>
        </tr>
      </table>
${conAdjunto && inline ? `
      <p style="margin: 20px 0 8px 0; color: #111827; font-size: 14px; font-weight: 700;">Comprobante</p>
      <img src="cid:comprobante" alt="Comprobante de pago" style="display:block; max-width: 100%; width: 100%; border: 1px solid #e5e7eb; border-radius: 8px;">` : conAdjunto ? `
      <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 13px;">📎 El comprobante es un PDF: va adjunto a este correo.</p>` : ''}
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
