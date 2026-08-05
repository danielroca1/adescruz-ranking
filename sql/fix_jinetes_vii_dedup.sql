-- Limpieza de jinetes duplicados / typo detectados tras el VII CDS (2026-06-02)
-- Merges:  "Azul Pantoja Andrade"  -> "Azul Pantoja"
--          "Lucas Cuellar Quiroga" -> "Lucas Cuellar"
-- Rename:  "Breana Ross"           -> "Breanna Ross"  (no es duplicado; typo de la tabla jinetes)
--
-- Patrón tomado de fix_jinetes_2026.sql (regla permanente 2026-04-17):
-- se desactivan triggers SOLO en esta transacción para bypassear jinetes_restrict_cols.
-- Idempotente: si una dup ya no existe, su bloque no hace nada.
-- resultados_pdf ya fue unificado por API; los pasos de resultados_pdf quedan como no-op de seguridad.

BEGIN;
SET LOCAL session_replication_role = replica;

CREATE OR REPLACE FUNCTION _merge_o_rename_jinete(p_dup TEXT, p_canon TEXT) RETURNS void AS $$
DECLARE
  v_canon_id UUID; v_dup_id UUID; v_rec RECORD; v_canon_bin UUID; v_dup_bin UUID;
BEGIN
  SELECT id INTO v_dup_id   FROM jinetes WHERE nombre = p_dup   LIMIT 1;
  IF v_dup_id IS NULL THEN RETURN; END IF;                 -- nada que hacer (idempotente)
  SELECT id INTO v_canon_id FROM jinetes WHERE nombre = p_canon LIMIT 1;

  IF v_canon_id IS NULL THEN
    -- CASO RENAME: el maestro no existe -> renombrar la fila dup
    UPDATE jinetes        SET nombre = p_canon WHERE id = v_dup_id;
    UPDATE resultados_pdf  SET jinete = p_canon WHERE jinete = p_dup;
    UPDATE ranking_historico SET jinete = p_canon WHERE jinete = p_dup;
    RETURN;
  END IF;

  -- CASO MERGE: ambos existen
  -- 1) Por cada caballo con binomio en AMBOS jinetes, fusionar binomios (resultados + ranking)
  FOR v_rec IN (
    SELECT DISTINCT b1.caballo_id AS cid
    FROM binomios b1 JOIN binomios b2 ON b1.caballo_id = b2.caballo_id
    WHERE b1.jinete_id = v_canon_id AND b2.jinete_id = v_dup_id
  ) LOOP
    SELECT id INTO v_canon_bin FROM binomios WHERE jinete_id = v_canon_id AND caballo_id = v_rec.cid LIMIT 1;
    SELECT id INTO v_dup_bin   FROM binomios WHERE jinete_id = v_dup_id   AND caballo_id = v_rec.cid LIMIT 1;

    DELETE FROM resultados res WHERE res.binomio_id = v_dup_bin
      AND EXISTS (SELECT 1 FROM resultados k WHERE k.binomio_id = v_canon_bin
                  AND k.fecha = res.fecha AND k.campeonato_id = res.campeonato_id);
    UPDATE resultados SET binomio_id = v_canon_bin WHERE binomio_id = v_dup_bin;

    UPDATE ranking k1 SET puntos_total = k1.puntos_total + k2.puntos_total,
                          participaciones = k1.participaciones + k2.participaciones
      FROM ranking k2 WHERE k1.binomio_id = v_canon_bin AND k2.binomio_id = v_dup_bin
                        AND k1.temporada = k2.temporada AND k1.categoria_id = k2.categoria_id;
    DELETE FROM ranking rh WHERE rh.binomio_id = v_dup_bin
      AND EXISTS (SELECT 1 FROM ranking k WHERE k.binomio_id = v_canon_bin
                  AND k.temporada = rh.temporada AND k.categoria_id = rh.categoria_id);
    UPDATE ranking SET binomio_id = v_canon_bin WHERE binomio_id = v_dup_bin;

    DELETE FROM binomios WHERE id = v_dup_bin;
  END LOOP;

  -- 2) Transferir binomios restantes del dup al maestro
  UPDATE binomios SET jinete_id = v_canon_id WHERE jinete_id = v_dup_id;

  -- 3) Repuntar perfiles.jinete_id_match si apuntaba al dup
  UPDATE perfiles SET jinete_id_match = v_canon_id WHERE jinete_id_match = v_dup_id;

  -- 4) Borrar el jinete duplicado
  DELETE FROM jinetes WHERE id = v_dup_id;

  -- 5) resultados_pdf (texto) — dedup preventivo + rename (ya unificado por API; no-op de seguridad)
  DELETE FROM resultados_pdf rp WHERE rp.jinete = p_dup
    AND EXISTS (SELECT 1 FROM resultados_pdf k WHERE k.jinete = p_canon
      AND k.concurso_id IS NOT DISTINCT FROM rp.concurso_id
      AND k.dia         IS NOT DISTINCT FROM rp.dia
      AND k.categoria   IS NOT DISTINCT FROM rp.categoria
      AND k.caballo     IS NOT DISTINCT FROM rp.caballo);
  UPDATE resultados_pdf SET jinete = p_canon WHERE jinete = p_dup;

  -- 6) ranking_historico (texto)
  UPDATE ranking_historico h1 SET puntos_total = h1.puntos_total + h2.puntos_total,
                                   participaciones = h1.participaciones + h2.participaciones, updated_at = now()
    FROM ranking_historico h2 WHERE h1.jinete = p_canon AND h2.jinete = p_dup
      AND h1.temporada = h2.temporada AND h1.caballo = h2.caballo AND h1.categoria_nombre = h2.categoria_nombre;
  DELETE FROM ranking_historico rh WHERE rh.jinete = p_dup
    AND EXISTS (SELECT 1 FROM ranking_historico k WHERE k.jinete = p_canon
      AND k.temporada = rh.temporada AND k.caballo = rh.caballo AND k.categoria_nombre = rh.categoria_nombre);
  UPDATE ranking_historico SET jinete = p_canon WHERE jinete = p_dup;
END $$ LANGUAGE plpgsql;

SELECT _merge_o_rename_jinete('Azul Pantoja Andrade',  'Azul Pantoja');
SELECT _merge_o_rename_jinete('Lucas Cuellar Quiroga', 'Lucas Cuellar');
SELECT _merge_o_rename_jinete('Breana Ross',           'Breanna Ross');

DROP FUNCTION _merge_o_rename_jinete(TEXT, TEXT);

SET LOCAL session_replication_role = DEFAULT;
COMMIT;

-- ===== Verificación (correr aparte; todos deben dar 0 / el estado esperado) =====
-- SELECT nombre FROM jinetes WHERE nombre IN ('Azul Pantoja Andrade','Lucas Cuellar Quiroga','Breana Ross');           -- 0 filas
-- SELECT nombre FROM jinetes WHERE nombre IN ('Azul Pantoja','Lucas Cuellar','Breanna Ross');                          -- 3 filas
-- SELECT jinete, count(*) FROM resultados_pdf WHERE jinete IN ('Azul Pantoja','Lucas Cuellar','Breanna Ross') GROUP BY 1;
