-- ═══════════════════════════════════════════════════════════════════════
-- Diagnóstico — Jinetes en 2+ categorías oficiales (temporada 2026)
-- Fecha: 2026-04-20
-- Regla ADESCRUZ: un jinete solo puede tener UNA categoría oficial con
--                 puntos. Las otras participaciones deben ser "Abierta".
-- Ignora: categoria='Abierta' y filas con ranking=false.
-- ═══════════════════════════════════════════════════════════════════════

-- NOTA: Se excluyen las filas con ranking_caballo=true (Caballos Novicios,
-- CJ S1, CJ S2) — en esas categorías los puntos van al CABALLO, no al
-- jinete, así que un jinete con varios caballos en esas categorías NO viola
-- la regla.

-- Consulta 1 — Lista compacta de jinetes problemáticos
-- (un jinete por fila, con sus categorías separadas por coma)
SELECT jinete,
       COUNT(DISTINCT categoria)            AS n_categorias,
       STRING_AGG(DISTINCT categoria, ', ' ORDER BY categoria) AS categorias
FROM resultados_pdf
WHERE ranking = true
  AND ranking_caballo = false
  AND LOWER(TRIM(categoria)) <> 'abierta'
GROUP BY jinete
HAVING COUNT(DISTINCT categoria) >= 2
ORDER BY jinete;

-- Consulta 2 — Detalle fila por fila de los conflictos
-- (útil para decidir cuál participación es la oficial y cuál debe ir a Abierta)
WITH conflictivos AS (
  SELECT jinete
  FROM resultados_pdf
  WHERE ranking = true
    AND ranking_caballo = false
    AND LOWER(TRIM(categoria)) <> 'abierta'
  GROUP BY jinete
  HAVING COUNT(DISTINCT categoria) >= 2
)
SELECT r.concurso_id,
       r.dia,
       r.jinete,
       r.caballo,
       r.categoria,
       r.puesto,
       r.puntos
FROM resultados_pdf r
JOIN conflictivos c ON c.jinete = r.jinete
WHERE r.ranking = true
  AND r.ranking_caballo = false
  AND LOWER(TRIM(r.categoria)) <> 'abierta'
ORDER BY r.jinete, r.concurso_id, r.dia, r.categoria;
