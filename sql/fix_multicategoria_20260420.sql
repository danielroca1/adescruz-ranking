-- ═══════════════════════════════════════════════════════════════════════
-- Fix jinetes en 2+ categorías oficiales → mover participaciones "extra" a Abierta
-- Fecha: 2026-04-20
-- Regla ADESCRUZ: un jinete = UNA categoría oficial con puntos.
--                 Las demás participaciones van como "Abierta" (ranking=false).
-- Método: UPDATE categoria='Abierta', ranking=false (preserva el registro).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1) Azul Pantoja ─────────────────────────────────────────────────────
-- Categoría oficial confirmada: Escuela Mayores (Bacardi)
-- Mover a Abierta: Futuros Campeones con Donato (I CDS SAB 7pts + DOM 4pts)
UPDATE resultados_pdf
SET categoria = 'Abierta',
    ranking   = false
WHERE concurso_id = 1
  AND jinete     = 'Azul Pantoja'
  AND caballo    = 'Donato'
  AND categoria  = 'Futuros Campeones';

-- ── 2) Fernando Bedoya Alipaz ───────────────────────────────────────────
-- Categoría oficial confirmada: Primera Categoría (Quallenium)
-- Mover a Abierta: Segunda Categoría con Cariló (I CDS SAB 7pts)
UPDATE resultados_pdf
SET categoria = 'Abierta',
    ranking   = false
WHERE jinete    = 'Fernando Bedoya Alipaz'
  AND caballo   = 'Cariló'
  AND categoria = 'Segunda Categoría';

-- ── 3) Margarita Lopez ──────────────────────────────────────────────────
-- Categoría oficial confirmada: Escuela Mayores (Santa Ana Angela / Roma)
-- Mover a Abierta: Futuros Campeones con Santa Angela Queen Mood (I CDS SAB+DOM)
UPDATE resultados_pdf
SET categoria = 'Abierta',
    ranking   = false
WHERE jinete    = 'Margarita Lopez'
  AND caballo   = 'Santa Angela Queen Mood'
  AND categoria = 'Futuros Campeones';

-- ── 4) Zoe Alvarez ──────────────────────────────────────────────────────
-- Categoría oficial confirmada: Escuela Menores (Toby)
-- Mover a Abierta: Futuros Campeones con Toby (I CDS SAB 7pts + DOM NSP)
UPDATE resultados_pdf
SET categoria = 'Abierta',
    ranking   = false
WHERE concurso_id = 1
  AND jinete     = 'Zoe Alvarez'
  AND caballo    = 'Toby'
  AND categoria  = 'Futuros Campeones';

COMMIT;

-- ── Verificación post-ejecución: 0 filas (todos los conflictos resueltos)
-- SELECT jinete, COUNT(DISTINCT categoria) AS n
-- FROM resultados_pdf
-- WHERE ranking = true
--   AND ranking_caballo = false
--   AND LOWER(TRIM(categoria)) <> 'abierta'
-- GROUP BY jinete
-- HAVING COUNT(DISTINCT categoria) >= 2
-- ORDER BY jinete;
