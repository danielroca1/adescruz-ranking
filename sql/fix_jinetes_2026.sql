-- Merge de jinete duplicado en tabla jinetes (2026)
-- Sandra Pascal → Sandra Pascual (typo, mismo SCIS)
-- Propagación: binomios, resultados, ranking, resultados_pdf, ranking_historico

BEGIN;

-- Bypass trigger jinetes_restrict_cols para DELETE de jinetes (per regla 2026-04-17)
SET LOCAL session_replication_role = replica;

DO $$
DECLARE
  v_canon_id UUID; v_dup_id UUID; v_rec RECORD; v_canon_bin UUID; v_dup_bin UUID;
  v_canon_name CONSTANT TEXT := 'Sandra Pascual';
  v_dup_name   CONSTANT TEXT := 'Sandra Pascal';
BEGIN
  SELECT id INTO v_canon_id FROM jinetes WHERE nombre = v_canon_name LIMIT 1;
  SELECT id INTO v_dup_id   FROM jinetes WHERE nombre = v_dup_name   LIMIT 1;

  IF v_canon_id IS NOT NULL AND v_dup_id IS NOT NULL THEN
    -- Para cada caballo que tiene binomio con AMBOS jinetes, mergear binomios
    FOR v_rec IN (
      SELECT DISTINCT b1.caballo_id AS cid
      FROM binomios b1 JOIN binomios b2 ON b1.caballo_id = b2.caballo_id
      WHERE b1.jinete_id = v_canon_id AND b2.jinete_id = v_dup_id
    ) LOOP
      SELECT id INTO v_canon_bin FROM binomios WHERE jinete_id = v_canon_id AND caballo_id = v_rec.cid LIMIT 1;
      SELECT id INTO v_dup_bin   FROM binomios WHERE jinete_id = v_dup_id   AND caballo_id = v_rec.cid LIMIT 1;

      DELETE FROM resultados res WHERE res.binomio_id = v_dup_bin
        AND EXISTS (SELECT 1 FROM resultados k WHERE k.binomio_id = v_canon_bin AND k.fecha = res.fecha AND k.campeonato_id = res.campeonato_id);
      UPDATE resultados SET binomio_id = v_canon_bin WHERE binomio_id = v_dup_bin;

      UPDATE ranking k1 SET puntos_total = k1.puntos_total + k2.puntos_total, participaciones = k1.participaciones + k2.participaciones
        FROM ranking k2 WHERE k1.binomio_id = v_canon_bin AND k2.binomio_id = v_dup_bin AND k1.temporada = k2.temporada AND k1.categoria_id = k2.categoria_id;
      DELETE FROM ranking rh WHERE rh.binomio_id = v_dup_bin
        AND EXISTS (SELECT 1 FROM ranking k WHERE k.binomio_id = v_canon_bin AND k.temporada = rh.temporada AND k.categoria_id = rh.categoria_id);
      UPDATE ranking SET binomio_id = v_canon_bin WHERE binomio_id = v_dup_bin;

      DELETE FROM binomios WHERE id = v_dup_bin;
    END LOOP;

    -- Transferir binomios restantes del dup al canon
    UPDATE binomios SET jinete_id = v_canon_id WHERE jinete_id = v_dup_id;

    -- Actualizar perfiles.jinete_id_match si apuntaba al dup
    UPDATE perfiles SET jinete_id_match = v_canon_id WHERE jinete_id_match = v_dup_id;

    -- Borrar jinete duplicado
    DELETE FROM jinetes WHERE id = v_dup_id;

    -- resultados_pdf (text) — dedup preventivo antes de UPDATE
    DELETE FROM resultados_pdf rp WHERE rp.jinete = v_dup_name
      AND EXISTS (SELECT 1 FROM resultados_pdf k WHERE k.jinete = v_canon_name
        AND k.concurso_id IS NOT DISTINCT FROM rp.concurso_id
        AND k.dia         IS NOT DISTINCT FROM rp.dia
        AND k.categoria   IS NOT DISTINCT FROM rp.categoria
        AND k.caballo     IS NOT DISTINCT FROM rp.caballo);
    UPDATE resultados_pdf SET jinete = v_canon_name WHERE jinete = v_dup_name;

    -- ranking_historico (UNIQUE temporada, jinete, caballo, categoria_nombre)
    UPDATE ranking_historico h1 SET puntos_total = h1.puntos_total + h2.puntos_total, participaciones = h1.participaciones + h2.participaciones, updated_at = now()
      FROM ranking_historico h2 WHERE h1.jinete = v_canon_name AND h2.jinete = v_dup_name AND h1.temporada = h2.temporada AND h1.caballo = h2.caballo AND h1.categoria_nombre = h2.categoria_nombre;
    DELETE FROM ranking_historico rh WHERE rh.jinete = v_dup_name
      AND EXISTS (SELECT 1 FROM ranking_historico k WHERE k.jinete = v_canon_name AND k.temporada = rh.temporada AND k.caballo = rh.caballo AND k.categoria_nombre = rh.categoria_nombre);
    UPDATE ranking_historico SET jinete = v_canon_name WHERE jinete = v_dup_name;
  END IF;
END $$;

SET LOCAL session_replication_role = DEFAULT;

COMMIT;

-- Verificación (debe devolver 0):
-- SELECT COUNT(*) FROM jinetes WHERE nombre = 'Sandra Pascal';
-- SELECT COUNT(*) FROM resultados_pdf WHERE jinete = 'Sandra Pascal';
