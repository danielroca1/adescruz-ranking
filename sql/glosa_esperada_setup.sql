-- ============================================================
-- Glosa esperada por CDS — para validar que el comprobante de pago
-- corresponda al CDS específico (no a otro pago).
-- ============================================================

ALTER TABLE public.campeonatos
  ADD COLUMN IF NOT EXISTS glosa_esperada text;

-- Backfill: rellenar con "{ROMAN} CDS 2026" para todas las filas vacías
UPDATE public.campeonatos SET glosa_esperada =
  CASE numero
    WHEN 1  THEN 'I CDS 2026'
    WHEN 2  THEN 'II CDS 2026'
    WHEN 3  THEN 'III CDS 2026'
    WHEN 4  THEN 'IV CDS 2026'
    WHEN 5  THEN 'V CDS 2026'
    WHEN 6  THEN 'VI CDS 2026'
    WHEN 7  THEN 'VII CDS 2026'
    WHEN 8  THEN 'VIII CDS 2026'
    WHEN 9  THEN 'IX CDS 2026'
    WHEN 10 THEN 'X CDS 2026'
    WHEN 11 THEN 'XI CDS 2026'
    WHEN 12 THEN 'XII CDS 2026'
    WHEN 13 THEN 'XIII CDS 2026'
    WHEN 14 THEN 'XIV CDS 2026'
    WHEN 15 THEN 'XV CDS 2026'
    WHEN 16 THEN 'XVI CDS 2026'
    WHEN 17 THEN 'XVII CDS 2026'
    ELSE numero || ' CDS 2026'
  END
WHERE temporada = 2026 AND glosa_esperada IS NULL;

-- Verificación
SELECT numero, nombre, glosa_esperada
FROM public.campeonatos
WHERE temporada = 2026
ORDER BY numero;
