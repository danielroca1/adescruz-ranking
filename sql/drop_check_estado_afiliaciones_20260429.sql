-- =====================================================================
-- Drop CHECK constraint en afiliaciones.estado
-- Fecha: 2026-04-29
--
-- Convención (igual que inscripciones): el campo `estado` es text libre.
-- Valores válidos: pendiente | revision_manual | aprobada | rechazada.
-- La validación se hace en app (Edge Function + admin.html), no a nivel DB.
-- =====================================================================

ALTER TABLE public.afiliaciones DROP CONSTRAINT IF EXISTS afiliaciones_estado_check;

-- Verificar que el constraint se haya borrado
SELECT conname
FROM pg_constraint
WHERE conrelid = 'public.afiliaciones'::regclass
  AND conname = 'afiliaciones_estado_check';
-- Si esta query devuelve 0 filas, el drop funcionó.
