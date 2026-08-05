-- =====================================================================
-- Fix RLS afiliaciones — permitir insert + read-after-insert
-- Fecha: 2026-04-29
--
-- Problema: el form de registro hace signUp ANTES del insert en afiliaciones.
-- Eso convierte al usuario en `authenticated`. La policy actual `public can insert
-- afiliaciones` aplica solo a `anon`, así que la insert falla con RLS error.
-- =====================================================================

-- 1) INSERT — permitir tanto anon (legacy) como authenticated (post-signUp)
DROP POLICY IF EXISTS "public can insert afiliaciones" ON public.afiliaciones;
CREATE POLICY "public can insert afiliaciones"
  ON public.afiliaciones
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 2) SELECT — el dueño de la afiliación (match por email) puede leer su propia fila
--    Necesario para que .select('id') después del insert devuelva el id.
--    Admins ya tienen lectura por otra policy (no la duplico).
DROP POLICY IF EXISTS "owner can read own afiliaciones" ON public.afiliaciones;
CREATE POLICY "owner can read own afiliaciones"
  ON public.afiliaciones
  FOR SELECT
  TO authenticated
  USING (
    email = (SELECT p.email FROM public.perfiles p WHERE p.id = auth.uid())
  );

-- =====================================================================
-- Verificación
-- =====================================================================
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'afiliaciones'
ORDER BY policyname;
