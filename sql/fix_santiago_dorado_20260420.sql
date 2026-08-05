-- ═══════════════════════════════════════════════════════════════════════
-- Fix Santiago Dorado — Infantil B → Cuarta Categoría
-- Fecha: 2026-04-20
-- Motivo: Decisión de reunión técnica — pierde puntos en Infantil B,
--         queda con participación SAB+DOM en Cuarta Categoría (0 pts).
--         Jinete: Santiago Dorado · Caballo: Next Funky · CDS: I CDS (concurso_id=1)
-- ═══════════════════════════════════════════════════════════════════════

-- Paso 0 — Diagnóstico (revisar antes de ejecutar):
-- SELECT concurso_id, dia, jinete, caballo, categoria, puesto, puntos, ranking
--   FROM resultados_pdf
--   WHERE jinete='Santiago Dorado' AND caballo='Next Funky'
--   ORDER BY concurso_id, dia, categoria;

BEGIN;

-- Paso 1 — Si ya existen filas en Cuarta Categoría para ese día, borrar las de Infantil B
-- (evita duplicados cuando la carga previa quedó a medias).
DELETE FROM resultados_pdf AS rp
WHERE rp.concurso_id = 1
  AND rp.jinete = 'Santiago Dorado'
  AND rp.caballo = 'Next Funky'
  AND rp.categoria = 'Infantil B'
  AND EXISTS (
    SELECT 1 FROM resultados_pdf rp2
    WHERE rp2.concurso_id = rp.concurso_id
      AND rp2.dia         = rp.dia
      AND rp2.jinete      = rp.jinete
      AND rp2.caballo     = rp.caballo
      AND rp2.categoria   = 'Cuarta Categoría'
  );

-- Paso 2 — Si sobreviven filas en Infantil B (no había Cuarta aún), convertirlas.
-- puesto=NULL, puntos=0: "pierde puntos en Infantil B, queda como participación 0pts en Cuarta".
UPDATE resultados_pdf
SET categoria = 'Cuarta Categoría',
    puesto    = NULL,
    puntos    = 0
WHERE concurso_id = 1
  AND jinete     = 'Santiago Dorado'
  AND caballo    = 'Next Funky'
  AND categoria  = 'Infantil B';

COMMIT;

-- Verificación post-ejecución:
-- (a) 0 filas en Infantil B:
-- SELECT * FROM resultados_pdf
--   WHERE jinete='Santiago Dorado' AND caballo='Next Funky' AND categoria='Infantil B';
-- (b) 2 filas en Cuarta Categoría con puesto=NULL y puntos=0:
-- SELECT concurso_id, dia, jinete, caballo, categoria, puesto, puntos, ranking
--   FROM resultados_pdf
--   WHERE jinete='Santiago Dorado' AND caballo='Next Funky' AND categoria='Cuarta Categoría'
--   ORDER BY dia;
