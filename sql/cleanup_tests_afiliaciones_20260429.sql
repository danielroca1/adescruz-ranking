-- =====================================================================
-- Cleanup de las 3 afiliaciones de prueba creadas en Fase E.
-- Cascade limpia afiliacion_caballos automáticamente (ON DELETE CASCADE).
-- =====================================================================

-- Borrar afiliaciones de test (por email pattern)
DELETE FROM public.afiliaciones
WHERE email LIKE 'daniel.roca.s+test-claude-%@gmail.com'
   OR email LIKE 'daniel.roca.s+test-edgefn%@gmail.com'
   OR email LIKE 'daniel.roca.s+test-antireuso%@gmail.com';

-- Borrar perfiles de test (no tienen ON DELETE CASCADE desde auth.users)
DELETE FROM public.perfiles
WHERE email LIKE 'daniel.roca.s+test-claude-%@gmail.com';

-- Verificación
SELECT
  (SELECT count(*) FROM public.afiliaciones        WHERE email LIKE '%test-claude-%' OR email LIKE '%test-edgefn%' OR email LIKE '%test-antireuso%') AS afil_restantes,
  (SELECT count(*) FROM public.afiliacion_caballos WHERE nombre_caballo IN ('TestPony292711', 'TestPony017553', 'TestCaballoEdgeFn', 'CaballoAntiReuso')) AS cab_restantes,
  (SELECT count(*) FROM public.perfiles            WHERE email LIKE '%test-claude-%') AS perf_restantes;
-- Las 3 deben dar 0.
