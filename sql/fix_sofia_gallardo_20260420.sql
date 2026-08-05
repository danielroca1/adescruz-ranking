-- ═══════════════════════════════════════════════════════════════════════
-- Fix duplicado ortográfico — Sofia Gallardo (sin tilde es el canonical)
-- Fecha: 2026-04-20
-- Motivo: 2 filas en resultados_pdf con 'Sofía Gallardo' quedaron como
--         binomio distinto de 'Sofia Gallardo' en el ranking.
--         Canonical existente en `jinetes` y `ranking_historico` = sin tilde.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE resultados_pdf
SET jinete = 'Sofia Gallardo'
WHERE jinete = 'Sofía Gallardo';

COMMIT;

-- Verificación post-ejecución:
-- (a) 0 filas con tilde:
-- SELECT COUNT(*) FROM resultados_pdf WHERE jinete = 'Sofía Gallardo';
-- (b) Todas las filas consolidadas bajo la canonical:
-- SELECT jinete, COUNT(*) FROM resultados_pdf WHERE jinete ILIKE 'sof__ gallardo' GROUP BY jinete;
