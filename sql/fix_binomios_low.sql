-- Merge de binomios duplicados (LOW priority)
-- Un binomio dup = mismo jinete_id + mismo caballo_id + distinto id.
-- Para cada grupo, elegimos el más antiguo como "keeper" y fusionamos el resto:
--   - transferir resultados.binomio_id (manejar UNIQUE por fecha+campeonato)
--   - merge ranking (sumar puntos + participaciones en colisión de temporada+categoria)
--   - borrar binomios duplicados
-- Generado 2026-04-19.

BEGIN;

DO $$
DECLARE
  v_group RECORD;
  v_keeper UUID;
  v_dup UUID;
  v_rec RECORD;
BEGIN
  -- Grupos de binomios duplicados (mismo jinete_id + caballo_id, >1 filas)
  FOR v_group IN (
    SELECT jinete_id, caballo_id
    FROM binomios
    GROUP BY jinete_id, caballo_id
    HAVING COUNT(*) > 1
  ) LOOP
    -- Keeper = el más antiguo
    SELECT id INTO v_keeper
    FROM binomios
    WHERE jinete_id = v_group.jinete_id AND caballo_id = v_group.caballo_id
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    -- Procesar cada dup (todos los demás en el grupo)
    FOR v_rec IN (
      SELECT id FROM binomios
      WHERE jinete_id = v_group.jinete_id AND caballo_id = v_group.caballo_id
        AND id <> v_keeper
    ) LOOP
      v_dup := v_rec.id;

      -- resultados: UNIQUE(binomio_id, fecha, campeonato_id)
      DELETE FROM resultados res WHERE res.binomio_id = v_dup
        AND EXISTS (SELECT 1 FROM resultados k WHERE k.binomio_id = v_keeper AND k.fecha = res.fecha AND k.campeonato_id = res.campeonato_id);
      UPDATE resultados SET binomio_id = v_keeper WHERE binomio_id = v_dup;

      -- ranking: UNIQUE(temporada, binomio_id, categoria_id)
      UPDATE ranking k1 SET puntos_total = k1.puntos_total + k2.puntos_total, participaciones = k1.participaciones + k2.participaciones
        FROM ranking k2 WHERE k1.binomio_id = v_keeper AND k2.binomio_id = v_dup AND k1.temporada = k2.temporada AND k1.categoria_id = k2.categoria_id;
      DELETE FROM ranking rh WHERE rh.binomio_id = v_dup
        AND EXISTS (SELECT 1 FROM ranking k WHERE k.binomio_id = v_keeper AND k.temporada = rh.temporada AND k.categoria_id = rh.categoria_id);
      UPDATE ranking SET binomio_id = v_keeper WHERE binomio_id = v_dup;

      -- Borrar binomio duplicado
      DELETE FROM binomios WHERE id = v_dup;
    END LOOP;
  END LOOP;
END $$;

COMMIT;

-- Verificación (debe devolver 0):
-- SELECT COUNT(*) FROM (
--   SELECT jinete_id, caballo_id FROM binomios GROUP BY jinete_id, caballo_id HAVING COUNT(*) > 1
-- ) t;
