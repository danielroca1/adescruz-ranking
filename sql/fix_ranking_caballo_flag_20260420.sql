-- ═══════════════════════════════════════════════════════════════════════
-- Fix flag ranking_caballo en resultados_pdf
-- Fecha: 2026-04-20
-- Motivo: Filas de Caballos Novicios / CJ S1 / CJ S2 quedaron con
--         ranking_caballo=false (probablemente carga temprana).
--         Esas categorías DEBEN tener ranking_caballo=true — los puntos
--         van al caballo, no al jinete.
-- ═══════════════════════════════════════════════════════════════════════

-- Diagnóstico previo — ¿cuántas filas están mal?
-- SELECT categoria, ranking_caballo, COUNT(*)
-- FROM resultados_pdf
-- WHERE categoria IN ('Caballos Novicios','Caballos Jóvenes S1','Caballos Jóvenes S2')
-- GROUP BY categoria, ranking_caballo
-- ORDER BY categoria, ranking_caballo;

BEGIN;

UPDATE resultados_pdf
SET ranking_caballo = true
WHERE categoria IN ('Caballos Novicios','Caballos Jóvenes S1','Caballos Jóvenes S2')
  AND ranking_caballo = false;

COMMIT;

-- Verificación post-ejecución (debe devolver 0 filas):
-- SELECT COUNT(*)
-- FROM resultados_pdf
-- WHERE categoria IN ('Caballos Novicios','Caballos Jóvenes S1','Caballos Jóvenes S2')
--   AND ranking_caballo = false;
