-- =====================================================================
-- 006 · auditoria_credenciales — 15-sep-2026
-- =====================================================================
-- Registro de todo lo que toca las credenciales de una cuenta desde el sistema:
--   · resetear_clave     — el superadmin le da una clave temporal (Edge Function resetear-clave)
--   · registrar_correo   — el jinete que entraba con usuario registra su casilla (registrar-correo)
--   · migrar_usuario     — pase de un correo inventado @correo.com a usuario (script de migracion)
--   · marcar_debe_cambiar — se prende la marca de cambio obligatorio (script de migracion)
--
-- NUNCA se guarda una clave: solo quien, a quien, cuando y el ingreso resultante.
-- Tabla nueva: no tiene triggers ni webhooks. Escribe solo la service role (las
-- Edge Functions); leer, solo el superadmin.
-- Idempotente.
-- =====================================================================

create table if not exists public.auditoria_credenciales (
  id          bigint generated always as identity primary key,
  creado_en   timestamptz not null default now(),
  accion      text not null check (accion in
                ('resetear_clave','registrar_correo','migrar_usuario','marcar_debe_cambiar')),
  actor_id    uuid,             -- quien lo hizo; null si fue un script
  usuario_id  uuid not null,    -- la cuenta afectada (auth.users.id)
  nombre      text,
  detalle     jsonb not null default '{}'::jsonb
);

create index if not exists auditoria_credenciales_usuario_idx
  on public.auditoria_credenciales (usuario_id, creado_en desc);

alter table public.auditoria_credenciales enable row level security;

drop policy if exists "superadmin lee la auditoria de credenciales" on public.auditoria_credenciales;
create policy "superadmin lee la auditoria de credenciales"
  on public.auditoria_credenciales for select to authenticated
  using (coalesce(public.get_my_rol(), '') = 'superadmin');

-- Sin policies de insert/update/delete: desde la pagina no se escribe.
revoke all on public.auditoria_credenciales from anon;

-- Verificacion
select count(*) filas,
       (select relrowsecurity from pg_class where oid = 'public.auditoria_credenciales'::regclass) rls,
       (select count(*) from pg_policy where polrelid = 'public.auditoria_credenciales'::regclass) policies,
       (select count(*) from pg_trigger where tgrelid = 'public.auditoria_credenciales'::regclass and not tgisinternal) triggers
  from public.auditoria_credenciales;
