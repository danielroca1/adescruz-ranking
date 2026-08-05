-- Merge de duplicados en caballos (HIGH priority) — v4 con DO blocks anónimos
-- Generado 2026-04-19. Ejecutar en Supabase SQL Editor.

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- PAR 1: América Da Riviera → America da Riviera
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_canon_id  UUID;
  v_dup_id    UUID;
  v_rec       RECORD;
  v_canon_bin UUID;
  v_dup_bin   UUID;
  v_canon_name CONSTANT TEXT := 'America da Riviera';
  v_dup_name   CONSTANT TEXT := 'América Da Riviera';
BEGIN
  SELECT id INTO v_canon_id FROM caballos WHERE nombre = v_canon_name LIMIT 1;
  SELECT id INTO v_dup_id   FROM caballos WHERE nombre = v_dup_name   LIMIT 1;

  IF v_canon_id IS NOT NULL AND v_dup_id IS NOT NULL THEN
  FOR v_rec IN (
    SELECT DISTINCT b1.jinete_id AS jid
    FROM binomios b1 JOIN binomios b2 ON b1.jinete_id = b2.jinete_id
    WHERE b1.caballo_id = v_canon_id AND b2.caballo_id = v_dup_id
  ) LOOP
    SELECT id INTO v_canon_bin FROM binomios WHERE caballo_id = v_canon_id AND jinete_id = v_rec.jid LIMIT 1;
    SELECT id INTO v_dup_bin   FROM binomios WHERE caballo_id = v_dup_id   AND jinete_id = v_rec.jid LIMIT 1;

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

  UPDATE binomios SET caballo_id = v_canon_id WHERE caballo_id = v_dup_id;
  DELETE FROM caballos WHERE id = v_dup_id;

  DELETE FROM resultados_pdf rp WHERE rp.caballo = v_dup_name
    AND EXISTS (SELECT 1 FROM resultados_pdf k WHERE k.caballo = v_canon_name
      AND k.concurso_id IS NOT DISTINCT FROM rp.concurso_id
      AND k.dia         IS NOT DISTINCT FROM rp.dia
      AND k.categoria   IS NOT DISTINCT FROM rp.categoria
      AND k.jinete      IS NOT DISTINCT FROM rp.jinete);
  UPDATE resultados_pdf SET caballo = v_canon_name WHERE caballo = v_dup_name;

  UPDATE ranking_historico h1 SET puntos_total = h1.puntos_total + h2.puntos_total, participaciones = h1.participaciones + h2.participaciones, updated_at = now()
    FROM ranking_historico h2 WHERE h1.caballo = v_canon_name AND h2.caballo = v_dup_name AND h1.temporada = h2.temporada AND h1.jinete = h2.jinete AND h1.categoria_nombre = h2.categoria_nombre;
  DELETE FROM ranking_historico rh WHERE rh.caballo = v_dup_name
    AND EXISTS (SELECT 1 FROM ranking_historico k WHERE k.caballo = v_canon_name AND k.temporada = rh.temporada AND k.jinete = rh.jinete AND k.categoria_nombre = rh.categoria_nombre);
  UPDATE ranking_historico SET caballo = v_canon_name WHERE caballo = v_dup_name;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- PAR 2: Belén → Belen
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_canon_id  UUID;
  v_dup_id    UUID;
  v_rec       RECORD;
  v_canon_bin UUID;
  v_dup_bin   UUID;
  v_canon_name CONSTANT TEXT := 'Belen';
  v_dup_name   CONSTANT TEXT := 'Belén';
BEGIN
  SELECT id INTO v_canon_id FROM caballos WHERE nombre = v_canon_name LIMIT 1;
  SELECT id INTO v_dup_id   FROM caballos WHERE nombre = v_dup_name   LIMIT 1;

  IF v_canon_id IS NOT NULL AND v_dup_id IS NOT NULL THEN
  FOR v_rec IN (
    SELECT DISTINCT b1.jinete_id AS jid
    FROM binomios b1 JOIN binomios b2 ON b1.jinete_id = b2.jinete_id
    WHERE b1.caballo_id = v_canon_id AND b2.caballo_id = v_dup_id
  ) LOOP
    SELECT id INTO v_canon_bin FROM binomios WHERE caballo_id = v_canon_id AND jinete_id = v_rec.jid LIMIT 1;
    SELECT id INTO v_dup_bin   FROM binomios WHERE caballo_id = v_dup_id   AND jinete_id = v_rec.jid LIMIT 1;

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

  UPDATE binomios SET caballo_id = v_canon_id WHERE caballo_id = v_dup_id;
  DELETE FROM caballos WHERE id = v_dup_id;

  DELETE FROM resultados_pdf rp WHERE rp.caballo = v_dup_name
    AND EXISTS (SELECT 1 FROM resultados_pdf k WHERE k.caballo = v_canon_name
      AND k.concurso_id IS NOT DISTINCT FROM rp.concurso_id
      AND k.dia         IS NOT DISTINCT FROM rp.dia
      AND k.categoria   IS NOT DISTINCT FROM rp.categoria
      AND k.jinete      IS NOT DISTINCT FROM rp.jinete);
  UPDATE resultados_pdf SET caballo = v_canon_name WHERE caballo = v_dup_name;

  UPDATE ranking_historico h1 SET puntos_total = h1.puntos_total + h2.puntos_total, participaciones = h1.participaciones + h2.participaciones, updated_at = now()
    FROM ranking_historico h2 WHERE h1.caballo = v_canon_name AND h2.caballo = v_dup_name AND h1.temporada = h2.temporada AND h1.jinete = h2.jinete AND h1.categoria_nombre = h2.categoria_nombre;
  DELETE FROM ranking_historico rh WHERE rh.caballo = v_dup_name
    AND EXISTS (SELECT 1 FROM ranking_historico k WHERE k.caballo = v_canon_name AND k.temporada = rh.temporada AND k.jinete = rh.jinete AND k.categoria_nombre = rh.categoria_nombre);
  UPDATE ranking_historico SET caballo = v_canon_name WHERE caballo = v_dup_name;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- PAR 3: D'orion → D'Orion
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_canon_id  UUID;
  v_dup_id    UUID;
  v_rec       RECORD;
  v_canon_bin UUID;
  v_dup_bin   UUID;
  v_canon_name CONSTANT TEXT := 'D''Orion';
  v_dup_name   CONSTANT TEXT := 'D''orion';
BEGIN
  SELECT id INTO v_canon_id FROM caballos WHERE nombre = v_canon_name LIMIT 1;
  SELECT id INTO v_dup_id   FROM caballos WHERE nombre = v_dup_name   LIMIT 1;

  IF v_canon_id IS NOT NULL AND v_dup_id IS NOT NULL THEN
  FOR v_rec IN (
    SELECT DISTINCT b1.jinete_id AS jid
    FROM binomios b1 JOIN binomios b2 ON b1.jinete_id = b2.jinete_id
    WHERE b1.caballo_id = v_canon_id AND b2.caballo_id = v_dup_id
  ) LOOP
    SELECT id INTO v_canon_bin FROM binomios WHERE caballo_id = v_canon_id AND jinete_id = v_rec.jid LIMIT 1;
    SELECT id INTO v_dup_bin   FROM binomios WHERE caballo_id = v_dup_id   AND jinete_id = v_rec.jid LIMIT 1;

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

  UPDATE binomios SET caballo_id = v_canon_id WHERE caballo_id = v_dup_id;
  DELETE FROM caballos WHERE id = v_dup_id;

  DELETE FROM resultados_pdf rp WHERE rp.caballo = v_dup_name
    AND EXISTS (SELECT 1 FROM resultados_pdf k WHERE k.caballo = v_canon_name
      AND k.concurso_id IS NOT DISTINCT FROM rp.concurso_id
      AND k.dia         IS NOT DISTINCT FROM rp.dia
      AND k.categoria   IS NOT DISTINCT FROM rp.categoria
      AND k.jinete      IS NOT DISTINCT FROM rp.jinete);
  UPDATE resultados_pdf SET caballo = v_canon_name WHERE caballo = v_dup_name;

  UPDATE ranking_historico h1 SET puntos_total = h1.puntos_total + h2.puntos_total, participaciones = h1.participaciones + h2.participaciones, updated_at = now()
    FROM ranking_historico h2 WHERE h1.caballo = v_canon_name AND h2.caballo = v_dup_name AND h1.temporada = h2.temporada AND h1.jinete = h2.jinete AND h1.categoria_nombre = h2.categoria_nombre;
  DELETE FROM ranking_historico rh WHERE rh.caballo = v_dup_name
    AND EXISTS (SELECT 1 FROM ranking_historico k WHERE k.caballo = v_canon_name AND k.temporada = rh.temporada AND k.jinete = rh.jinete AND k.categoria_nombre = rh.categoria_nombre);
  UPDATE ranking_historico SET caballo = v_canon_name WHERE caballo = v_dup_name;
  END IF;
END $$;

COMMIT;

-- Verificación (debe devolver 0 filas cada SELECT):
-- SELECT nombre FROM caballos WHERE nombre IN ('América Da Riviera','Belén','D''orion');
-- SELECT caballo FROM resultados_pdf WHERE caballo IN ('América Da Riviera','Belén','D''orion');
-- SELECT caballo FROM ranking_historico WHERE caballo IN ('América Da Riviera','Belén','D''orion');
