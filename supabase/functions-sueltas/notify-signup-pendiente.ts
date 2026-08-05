// Edge Function: notify-signup-pendiente
// Dispara cuando un nuevo jinete crea cuenta (INSERT en perfiles con rol=jinete, aprobado=false).
// Manda email al admin con info del match detectado al signup.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ADMIN_EMAIL    = 'daniel.roca.s@gmail.com';
const FROM_EMAIL     = 'ADESCRUZ <no-reply@adescruz.com>';

serve(async (req) => {
  try {
    const payload = await req.json();
    const newRow  = payload.record;

    if (!newRow) return new Response('ignored: no record', { status: 200 });

    // Solo disparar para jinetes pendientes de aprobación
    if (newRow.rol !== 'jinete' || newRow.aprobado === true) {
      return new Response('ignored: not a pending jinete', { status: 200 });
    }

    const matchStatus    = newRow.match_status || 'no_match';
    const jineteIdMatch  = newRow.jinete_id_match;

    // Si hay match, traemos los datos del jinete existente para incluirlos
    let jineteMatchInfo = null;
    if (matchStatus === 'matched' && jineteIdMatch && SUPABASE_URL && SERVICE_KEY) {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/jinetes?id=eq.${jineteIdMatch}&select=id,nombre,club,email,categoria_id`, {
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
        });
        const arr = await r.json();
        if (Array.isArray(arr) && arr.length) jineteMatchInfo = arr[0];
      } catch(_) { /* no-op */ }
    }

    // Si ambiguo, listamos las coincidencias
    let ambiguousMatches: any[] = [];
    if (matchStatus === 'ambiguous' && SUPABASE_URL && SERVICE_KEY) {
      try {
        // Buscar todos los jinetes para filtrar luego — mismo criterio del frontend
        const r = await fetch(`${SUPABASE_URL}/rest/v1/jinetes?select=id,nombre,club`, {
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
        });
        const all = await r.json();
        const norm = (s: string) => (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
        const nN = norm(newRow.nombre || '');
        ambiguousMatches = (Array.isArray(all) ? all : []).filter((j: any) => norm(j.nombre) === nN);
      } catch(_) { /* no-op */ }
    }

    // Armar el bloque principal del email según match_status
    let statusLabel = '';
    let statusColor = '';
    let statusBlock = '';

    if (matchStatus === 'matched' && jineteMatchInfo) {
      statusLabel = '✅ HAY PERFIL PREVIO';
      statusColor = '#166534';
      statusBlock = `
        <div style="margin-top:20px;padding:14px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:14px">
          <div style="font-weight:700;color:#166534;margin-bottom:8px">Se vinculará con el jinete existente:</div>
          <div style="color:#14532d"><strong>${jineteMatchInfo.nombre}</strong></div>
          <div style="color:#166534;font-size:13px">Club: ${jineteMatchInfo.club || '—'} · Email previo: ${jineteMatchInfo.email || '—'}</div>
        </div>`;
    } else if (matchStatus === 'ambiguous') {
      statusLabel = '⚠️ MATCH AMBIGUO';
      statusColor = '#92400e';
      statusBlock = `
        <div style="margin-top:20px;padding:14px 16px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;font-size:14px">
          <div style="font-weight:700;color:#92400e;margin-bottom:8px">Se detectaron múltiples jinetes con ese nombre. Decidí manualmente al aprobar.</div>
          ${ambiguousMatches.map(m => `<div style="color:#78350f;margin-top:4px">· <strong>${m.nombre}</strong> — ${m.club || 'sin club'}</div>`).join('')}
        </div>`;
    } else {
      statusLabel = '🆕 SIN PERFIL PREVIO';
      statusColor = '#1e40af';
      statusBlock = `
        <div style="margin-top:20px;padding:14px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:14px">
          <div style="font-weight:700;color:#1e40af;margin-bottom:4px">No se encontró un jinete con ese nombre en el sistema.</div>
          <div style="color:#1e3a8a;font-size:13px">Al aprobar, se creará automáticamente una nueva fila en <code>jinetes</code> con los datos del signup.</div>
        </div>`;
    }

    const subject = `🆔 Signup pendiente: ${newRow.nombre} · ${statusLabel}`;

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
        <h2 style="color:#1a4731;margin-bottom:4px">Nuevo signup de jinete</h2>
        <p style="color:#6b7280;margin-bottom:16px">Un jinete creó una cuenta y espera tu aprobación.</p>

        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:${statusColor}15;color:${statusColor};font-weight:700;font-size:13px;margin-bottom:16px">
          ${statusLabel}
        </div>

        <table style="border-collapse:collapse;width:100%;font-size:14px;background:#f9fafb;border-radius:8px;overflow:hidden">
          <tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280">Nombre</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:600">${newRow.nombre||'—'}</td></tr>
          <tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280">Email</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">${newRow.email||'—'}</td></tr>
          <tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280">Celular</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">${newRow.celular||'—'}</td></tr>
          <tr><td style="padding:10px 14px;color:#6b7280">Club</td><td style="padding:10px 14px">${newRow.club||'—'}</td></tr>
        </table>

        ${statusBlock}

        <p style="margin-top:24px;font-size:13px;color:#6b7280;line-height:1.5">
          Aprobar desde <a href="https://www.adescruz.com/admin.html" style="color:#1a4731;font-weight:600">admin → Jinetes → Aprobaciones</a>.
        </p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type' : 'application/json'
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [ADMIN_EMAIL], subject, html })
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('Resend error:', body);
      return new Response('resend error: ' + body, { status: 500 });
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response('error: ' + ((e as any).message || e), { status: 500 });
  }
});
