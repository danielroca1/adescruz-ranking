// ============================================================
// Edge Function: resetear-clave
//
// Le da una clave temporal ALEATORIA a la cuenta de un jinete que se olvido la suya
// o que no tiene correo donde recibir el link de recuperacion, y le deja prendida
// la marca user_metadata.debe_cambiar: en su proximo ingreso mi_perfil.html lo
// obliga a elegir una propia.
//
// Solo la usa el SUPERADMIN (decision de Daniel, 15-sep-2026), desde admin.html.
// La clave se devuelve UNA vez para mandarla por WhatsApp y no se guarda en ningun
// lado: el registro en auditoria_credenciales dice quien, a quien y cuando, sin la clave.
//
// No manda correos: la admin API cambia la clave directo.
// Body: { usuario_id: uuid }   ·   Header: Authorization: Bearer <token de la sesion>
// ============================================================
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { CORS, DOMINIO_USUARIO, clienteAdmin, generarClave, json, usuarioQueLlama } from '../_shared/credenciales.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' });

  const admin = clienteAdmin();
  const quien = await usuarioQueLlama(admin, req);
  if (!quien) return json(401, { error: 'Sesión inválida o vencida. Vuelva a ingresar.' });

  const { data: perfilQuien } = await admin.from('perfiles').select('rol').eq('id', quien.id).maybeSingle();
  if (perfilQuien?.rol !== 'superadmin') return json(403, { error: 'Solo el superadmin puede resetear claves.' });

  let body: { usuario_id?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'Pedido inválido.' }); }
  const usuarioId = String(body?.usuario_id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usuarioId)) {
    return json(400, { error: 'Cuenta inválida.' });
  }

  const { data: objetivo, error: eObj } = await admin.auth.admin.getUserById(usuarioId);
  if (eObj || !objetivo?.user) return json(404, { error: 'Esa cuenta no existe en Auth.' });
  const { data: perfil } = await admin.from('perfiles').select('rol, nombre').eq('id', usuarioId).maybeSingle();
  if (perfil?.rol === 'superadmin') {
    return json(400, { error: 'La clave de un superadmin no se resetea desde acá.' });
  }

  const clave = generarClave(10);
  // user_metadata COMPLETO: da igual si la API mezcla o reemplaza la metadata existente.
  const metadata = { ...(objetivo.user.user_metadata || {}), debe_cambiar: true };
  const { error: eUpd } = await admin.auth.admin.updateUserById(usuarioId, { password: clave, user_metadata: metadata });
  if (eUpd) return json(500, { error: 'No se pudo cambiar la clave: ' + eUpd.message });

  const email = (objetivo.user.email || '').toLowerCase();
  const usuario = email.endsWith(DOMINIO_USUARIO) ? email.slice(0, -DOMINIO_USUARIO.length) : null;

  const avisos: string[] = [];
  const { error: eAud } = await admin.from('auditoria_credenciales').insert({
    accion: 'resetear_clave', actor_id: quien.id, usuario_id: usuarioId,
    nombre: perfil?.nombre ?? null, detalle: { ingreso: usuario || email },
  });
  if (eAud) {
    // La clave YA cambio: se devuelve igual, pero avisando que no quedo registrado.
    console.error('auditoria_credenciales:', eAud.message);
    avisos.push('La clave cambió, pero no quedó registrada en la auditoría: ' + eAud.message);
  }

  return json(200, { ok: true, clave, ingreso: usuario || email, es_usuario: !!usuario, nombre: perfil?.nombre ?? null, avisos });
});
