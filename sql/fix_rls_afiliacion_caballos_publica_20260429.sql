-- =====================================================================
-- Permitir lectura pública (anon) de caballos en afiliaciones APROBADAS.
-- Necesario para que el form de registro detecte caballos compartidos
-- antes de que el usuario haga signUp.
--
-- Solo se exponen rows cuya afiliación padre está en estado='aprobada'.
-- Las afiliaciones rechazadas/pendientes/revision_manual quedan privadas.
-- =====================================================================

DROP POLICY IF EXISTS "afiliacion_caballos public read aprobados" ON public.afiliacion_caballos;
CREATE POLICY "afiliacion_caballos public read aprobados"
  ON public.afiliacion_caballos
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.afiliaciones a
      WHERE a.id = afiliacion_caballos.afiliacion_id
        AND a.estado = 'aprobada'
    )
  );

-- Verificación
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'afiliacion_caballos'
ORDER BY policyname;
