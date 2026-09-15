// Piezas comunes de las funciones que tocan credenciales de Auth
// (resetear-clave y registrar-correo).
import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Cuentas sin correo propio: el jinete entra con un usuario "nombre.apellido" y la
// pagina lo convierte en nombre.apellido@jinetes.adescruz.com. Ese subdominio no
// recibe correo. '@correo.com' es el dominio inventado anterior (dominio REAL, con
// servidor de correo de un tercero): se sigue aceptando como provisorio mientras
// quede alguna cuenta sin migrar.
export const DOMINIO_USUARIO = '@jinetes.adescruz.com';
export const DOMINIOS_PROVISORIOS = [DOMINIO_USUARIO, '@correo.com'];

export const esProvisorio = (email?: string | null) =>
  DOMINIOS_PROVISORIOS.some((d) => (email || '').toLowerCase().endsWith(d));

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export function clienteAdmin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Quien llama, a partir del token de SU sesion (no de la anon key).
export async function usuarioQueLlama(admin: SupabaseClient, req: Request): Promise<User | null> {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  return error || !data?.user ? null : data.user;
}

// Clave temporal legible: sin I, l, O, 0 ni 1, que se confunden al dictarla por WhatsApp.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
export function generarClave(largo = 10): string {
  const limite = 256 - (256 % ALFABETO.length); // descarta bytes que sesgarian la distribucion
  let out = '';
  while (out.length < largo) {
    const bytes = crypto.getRandomValues(new Uint8Array(largo * 2));
    for (const b of bytes) {
      if (b < limite && out.length < largo) out += ALFABETO[b % ALFABETO.length];
    }
  }
  return out;
}
