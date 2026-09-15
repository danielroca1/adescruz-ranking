// ============================================================
// Edge Function: registrar-correo
//
// El jinete que entra con un USUARIO (cuenta creada sin correo propio, con
// nombre.apellido@jinetes.adescruz.com) registra su casilla real en el primer ingreso.
//
// Por que en el servidor y no con supabase.auth.updateUser({ email }) desde la pagina:
// ese camino manda un link de confirmacion y, si Supabase exige confirmar TAMBIEN desde
// el correo viejo, estas cuentas nunca podrian terminar (el correo viejo no existe).
// Aca el cambio es inmediato: desde ese momento entra con su correo.
// Lo que se resigna: no se prueba que la casilla sea suya. Por eso la pagina la pide
// dos veces, y si se equivoca queda el reset del superadmin.
//
// Solo acepta cuentas cuyo correo actual es provisorio. No manda correos.
// Body: { email }   ·   Header: Authorization: Bearer <token de la sesion>
// ============================================================
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { CORS, clienteAdmin, esProvisorio, json, usuarioQueLlama } from '../_shared/credenciales.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' });

  const admin = clienteAdmin();
  const quien = await usuarioQueLlama(admin, req);
  if (!quien) return json(401, { error: 'Sesión inválida o vencida. Vuelva a ingresar.' });

  const actual = (quien.email || '').toLowerCase();
  if (!esProvisorio(actual)) {
    return json(400, { error: 'Su cuenta ya tiene un correo propio: cámbielo desde Datos de contacto.' });
  }

  let body: { email?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'Pedido inválido.' }); }
  const nuevo = String(body?.email || '').trim().toLowerCase();
  if (nuevo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(nuevo)) {
    return json(400, { error: 'Correo inválido.' });
  }
  if (esProvisorio(nuevo)) return json(400, { error: 'Ese correo es provisorio. Ponga una casilla suya.' });

  const { data: otro } = await admin.from('perfiles').select('id').ilike('email', nuevo).neq('id', quien.id).limit(1);
  if (otro && otro.length) {
    return json(409, { error: 'Ese correo ya lo usa otra cuenta. Si es de un familiar, escriba a ADESCRUZ.' });
  }

  // 1) Auth primero. user_metadata completo; si guarda una copia del correo, se actualiza.
  const metadata: Record<string, unknown> = { ...(quien.user_metadata || {}) };
  if ('email' in metadata) metadata.email = nuevo;
  const { error: eUpd } = await admin.auth.admin.updateUserById(quien.id, {
    email: nuevo, email_confirm: true, user_metadata: metadata,
  });
  if (eUpd) {
    const repetido = /already|registered|exists|duplicate/i.test(eUpd.message);
    return json(repetido ? 409 : 500, {
      error: repetido ? 'Ese correo ya lo usa otra cuenta.' : 'No se pudo registrar el correo: ' + eUpd.message,
    });
  }

  // 2) Recien con Auth cambiado, los espejos: perfiles (siempre) y la ficha del jinete
  //    solo si no tenia un correo de contacto propio.
  const avisos: string[] = [];
  const { error: ePerf } = await admin.from('perfiles').update({ email: nuevo }).eq('id', quien.id);
  if (ePerf) avisos.push('perfiles: ' + ePerf.message);
  const { error: eJin } = await admin.from('jinetes').update({ email: nuevo }).eq('perfil_id', quien.id).is('email', null);
  if (eJin) avisos.push('jinetes: ' + eJin.message);

  const { error: eAud } = await admin.from('auditoria_credenciales').insert({
    accion: 'registrar_correo', actor_id: quien.id, usuario_id: quien.id,
    nombre: (quien.user_metadata as Record<string, unknown>)?.nombre ?? null,
    detalle: { antes: actual, despues: nuevo },
  });
  if (eAud) avisos.push('auditoria: ' + eAud.message);
  if (avisos.length) console.error('registrar-correo:', avisos.join(' | '));

  return json(200, { ok: true, email: nuevo, avisos });
});
