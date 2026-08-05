-- Fix duplicados en resultados_pdf (ejecutar en Supabase SQL Editor)
-- Generado 2026-04-19 — canonicaliza nombres de jinete y caballo

BEGIN;

-- (1) Isabella Trujillo: Sion → Zion  (Futuros Campeones, 2 rows esperados)
UPDATE resultados_pdf
SET caballo = 'Zion'
WHERE categoria = 'Futuros Campeones'
  AND jinete = 'Isabella Trujillo'
  AND caballo = 'Sion';

-- (2) Breana → Breanna Ross  (Futuros Campeones, 3 rows esperados)
UPDATE resultados_pdf
SET jinete = 'Breanna Ross'
WHERE categoria = 'Futuros Campeones'
  AND jinete = 'Breana Ross';

-- (3) Sara Viera → Sarah Viera  (Pre Infantil, 1 row esperado)
UPDATE resultados_pdf
SET jinete = 'Sarah Viera'
WHERE categoria = 'Pre Infantil'
  AND jinete = 'Sara Viera';

-- (4) Channel → Chanel (solo Sarah Viera en Pre Infantil, 1 row esperado)
UPDATE resultados_pdf
SET caballo = 'Chanel'
WHERE categoria = 'Pre Infantil'
  AND jinete = 'Sarah Viera'
  AND caballo = 'Channel';

-- (5) Camila Montaño Vertiz → Camila Montaño  (Pre Infantil, 1 row esperado)
UPDATE resultados_pdf
SET jinete = 'Camila Montaño'
WHERE categoria = 'Pre Infantil'
  AND jinete = 'Camila Montaño Vertiz';

-- (6) co Aurora → Aurora  (Pre Infantil, 1 row esperado)
UPDATE resultados_pdf
SET caballo = 'Aurora'
WHERE categoria = 'Pre Infantil'
  AND caballo = 'co Aurora';

-- (7) Fabio Palma Escalante → Fabio Palma  (Cuarta Categoría, 1 row esperado)
UPDATE resultados_pdf
SET jinete = 'Fabio Palma'
WHERE categoria = 'Cuarta Categoría'
  AND jinete = 'Fabio Palma Escalante';

COMMIT;

-- Verificación post-ejecución (debe mostrar 0 filas para cada variante mala):
-- SELECT * FROM resultados_pdf WHERE caballo IN ('Sion','co Aurora','Channel');
-- SELECT * FROM resultados_pdf WHERE jinete IN ('Breana Ross','Sara Viera','Camila Montaño Vertiz','Fabio Palma Escalante');
