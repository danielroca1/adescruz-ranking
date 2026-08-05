-- =====================================================================
-- Canonicalizar rol 'superadmin' (sin underscore) en todas las policies
-- Fecha: 2026-05-04
-- Contexto:
--   La tabla perfiles tiene rol = 'superadmin' (junto). La mayoría de
--   policies usa esa variante. Pero 4 policies introducidas en migrations
--   posteriores usan 'super_admin' (con underscore), que NO matchea
--   ningún usuario real → bug latente.
--
-- Este script:
--   1. Reescribe las 4 policies inconsistentes con 'superadmin'
--   2. Limpia la policy de clubes (que aceptaba ambos defensivamente)
--   3. Agrega CHECK constraint a perfiles.rol para prevenir typos futuros
-- =====================================================================

-- ─── 1) afiliacion_caballos — 3 policies
DROP POLICY IF EXISTS "afiliacion_caballos borrar admin" ON public.afiliacion_caballos;
CREATE POLICY "afiliacion_caballos borrar admin"
  ON public.afiliacion_caballos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('admin','superadmin')
        AND p.activo = true
    )
  );

DROP POLICY IF EXISTS "afiliacion_caballos lectura" ON public.afiliacion_caballos;
CREATE POLICY "afiliacion_caballos lectura"
  ON public.afiliacion_caballos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.afiliaciones a
      WHERE a.id = afiliacion_caballos.afiliacion_id
        AND (
          a.email = (SELECT email FROM public.perfiles WHERE id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.perfiles p
            WHERE p.id = auth.uid()
              AND p.rol IN ('admin','superadmin')
              AND p.activo = true
          )
        )
    )
  );

DROP POLICY IF EXISTS "afiliacion_caballos modificar admin" ON public.afiliacion_caballos;
CREATE POLICY "afiliacion_caballos modificar admin"
  ON public.afiliacion_caballos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('admin','superadmin')
        AND p.activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('admin','superadmin')
        AND p.activo = true
    )
  );

-- ─── 2) tarifas_afiliacion — 1 policy
DROP POLICY IF EXISTS "tarifas_afiliacion escritura admin" ON public.tarifas_afiliacion;
CREATE POLICY "tarifas_afiliacion escritura admin"
  ON public.tarifas_afiliacion
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('admin','superadmin')
        AND p.activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('admin','superadmin')
        AND p.activo = true
    )
  );

-- ─── 3) clubes — limpiar policy con 3 variantes
DROP POLICY IF EXISTS "clubes escritura admin" ON public.clubes;
CREATE POLICY "clubes escritura admin"
  ON public.clubes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('admin','superadmin')
        AND p.activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('admin','superadmin')
        AND p.activo = true
    )
  );

-- ─── 4) CHECK constraint en perfiles.rol — prevenir typos futuros
-- Verificación previa: confirma que no hay valores fuera de los esperados
DO $$
DECLARE
  invalid_count int;
  invalid_values text;
BEGIN
  SELECT COUNT(*), string_agg(DISTINCT rol, ', ')
    INTO invalid_count, invalid_values
    FROM public.perfiles
    WHERE rol NOT IN ('superadmin','admin','juez','jinete');
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'No se puede agregar CHECK: % perfiles con rol inválido (%)', invalid_count, invalid_values;
  END IF;
END $$;

ALTER TABLE public.perfiles
  DROP CONSTRAINT IF EXISTS perfiles_rol_check;
ALTER TABLE public.perfiles
  ADD CONSTRAINT perfiles_rol_check
  CHECK (rol IN ('superadmin','admin','juez','jinete'));

-- =====================================================================
-- Verificación post-ejecución
-- =====================================================================

-- 4 policies fixed deben aparecer ahora con 'superadmin'
SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr
  FROM pg_policy
 WHERE polname IN (
    'afiliacion_caballos borrar admin',
    'afiliacion_caballos lectura',
    'afiliacion_caballos modificar admin',
    'tarifas_afiliacion escritura admin',
    'clubes escritura admin'
  )
 ORDER BY polname;
