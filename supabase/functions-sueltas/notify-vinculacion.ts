// Edge Function: notify-vinculacion
// Dispara cuando un jinete vincula su cuenta de usuario a su perfil
// (cuando jinetes.perfil_id pasa de NULL a un valor)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ADMIN_EMAIL    = 'daniel.roca.s@gmail.com';
const FROM_EMAIL     = 'ADESCRUZ <no-reply@adescruz.com>';

serve(async (req) => {
  try {
    const payload = await req.json();
    const oldRow  = payload.old_record;
    const newRow  = payload.record;

    if (!oldRow || !newRow) {
      return new Response('ignored: no records', { status: 200 });
    }

    // Solo disparar cuando perfil_id pasa de NULL a un valor
    if (oldRow.perfil_id !== null || newRow.perfil_id === null) {
      return new Response('ignored: not a new link', { status: 200 });
    }

    const subject = `🔗 Jinete vinculado: ${newRow.nombre}`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
        <h2 style="color:#1a4731;margin-bottom:4px">Nueva vinculación en ADESCRUZ</h2>
        <p style="color:#6b7280;margin-bottom:20px">Un jinete acaba de vincular su cuenta de usuario con su perfil de jinete.</p>

        <table style="border-collapse:collapse;width:100%;font-size:14px;background:#f9fafb;border-radius:8px;overflow:hidden">
          <tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280">Jinete</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:600">${newRow.nombre||'—'}</td></tr>
          <tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280">Email</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">${newRow.email||'—'}</td></tr>
          <tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280">Club</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">${newRow.club||'—'}</td></tr>
          <tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280">Celular</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">${newRow.celular||'—'}</td></tr>
          <tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280">Jinete ID</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${newRow.id}</td></tr>
          <tr><td style="padding:10px 14px;color:#6b7280">Auth User ID</td><td style="padding:10px 14px;font-family:monospace;font-size:12px">${newRow.perfil_id}</td></tr>
        </table>

        <p style="margin-top:20px;color:#6b7280;font-size:13px;line-height:1.5">
          Si detectás que la vinculación es incorrecta (por ejemplo dos jinetes con el mismo email que se cruzaron),
          podés desvincular desde <strong>admin → Jinetes → Listado</strong>.
        </p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type' : 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject,
        html
      })
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('Resend error:', body);
      return new Response('resend error: ' + body, { status: 500 });
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response('error: ' + (e.message||e), { status: 500 });
  }
});
