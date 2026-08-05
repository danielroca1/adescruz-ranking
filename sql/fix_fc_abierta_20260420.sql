-- ═══════════════════════════════════════════════════════════════════════
-- Reclasificar participaciones FC irregulares → Abierta
-- Fecha: 2026-04-20
-- Motivo: Un jinete no puede estar en 2 categorías oficiales sumando puntos.
--         Las participaciones listadas abajo son en realidad "Abierta",
--         no deben aparecer en el ranking de Futuros Campeones ni sumar
--         puntos / participaciones al perfil del jinete.
--
-- Método: UPDATE categoria='Abierta', ranking=false (conserva registro).
--         jinete_perfil.html y ranking_cds_2026.html filtran Abierta.
--
-- Ejecutar en Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Catalina Montaño / Kiara — I CDS (SAB 2026-02-07 + DOM 2026-02-08)
-- Categoría oficial 2026: Escuela Menores.
-- Filas esperadas: 2 (Sáb NSP 0pts, Dom 1° 7pts)
UPDATE resultados_pdf
SET categoria = 'Abierta',
    ranking   = false
WHERE concurso_id = 1
  AND categoria   = 'Futuros Campeones'
  AND jinete      = 'Catalina Montaño'
  AND caballo     = 'Kiara';

-- ── Carlos Zamorano / Conquistador — IV CDS (SAB 2026-04-11 + DOM 2026-04-12)
-- Categoría oficial 2026: Escuela Mayores.
-- Filas esperadas: 2 (Sáb FC + Dom FC con 4 faltas)
UPDATE resultados_pdf
SET categoria = 'Abierta',
    ranking   = false
WHERE concurso_id = 4
  AND categoria   = 'Futuros Campeones'
  AND jinete      = 'Carlos Zamorano'
  AND caballo     = 'Conquistador';

COMMIT;

-- ── Verificación post-ejecución (deben devolver 0 filas):
-- SELECT * FROM resultados_pdf
--   WHERE categoria='Futuros Campeones' AND jinete='Catalina Montaño' AND caballo='Kiara';
-- SELECT * FROM resultados_pdf
--   WHERE categoria='Futuros Campeones' AND jinete='Carlos Zamorano' AND caballo='Conquistador';

-- ── Verificación Abierta (deben aparecer 2 filas cada una):
-- SELECT concurso_id, dia, jinete, caballo, categoria, puesto, puntos, ranking
--   FROM resultados_pdf
--   WHERE jinete='Catalina Montaño' AND caballo='Kiara' AND categoria='Abierta';
-- SELECT concurso_id, dia, jinete, caballo, categoria, puesto, puntos, ranking
--   FROM resultados_pdf
--   WHERE jinete='Carlos Zamorano' AND caballo='Conquistador' AND categoria='Abierta';
