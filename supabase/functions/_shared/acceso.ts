// ─── Quién llama a una Edge Function (24-sep-2026) ──────────────────────────
// Las funciones que llama el público (el formulario con la clave pública, los
// webhooks de la base sin token) no pueden pedir sesión. Pero algunas cosas
// —releer un comprobante viejo, ver lo que leyó el OCR, mandar avisos— son solo
// para el admin o para la clave de servicio (reintentos desde la CLI).
//
// Admin: un token de sesión válido de un perfil admin/superadmin.
// Clave de servicio: no se compara el texto contra el env (el runtime puede tener
// otro formato de clave): se la USA contra `operaciones_consumidas`, que tiene RLS
// sin políticas — solo service_role ve filas. PostgREST verifica la firma; la
// clave pública o un token cualquiera ven cero filas y no pasan. (Mismo criterio
// que el modo «leer» de validar-comprobante-afiliacion.)
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

export async function esServicioOAdmin(sb: SupabaseClient, req: Request): Promise<boolean> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  try {
    const { data: u } = await sb.auth.getUser(token);
    const uid = u?.user?.id;
    if (uid) {
      const { data: perfil } = await sb.from('perfiles').select('rol').eq('id', uid).maybeSingle();
      return !!perfil && ['admin', 'superadmin'].includes(perfil.rol);
    }
    const probe = createClient(Deno.env.get('SUPABASE_URL')!, token, { auth: { persistSession: false } });
    const { data: filas } = await probe.from('operaciones_consumidas').select('nro_operacion').limit(1);
    return Array.isArray(filas) && filas.length > 0;
  } catch (_) {
    return false;
  }
}
