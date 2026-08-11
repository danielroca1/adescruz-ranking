-- ════════════════════════════════════════════════════════
-- 005 — Normalizar resultados_pdf: separar números de códigos
-- ════════════════════════════════════════════════════════
--
-- QUÉ ARREGLA
-- Hoy las columnas tiempo / ft / total / puesto son TEXTO y mezclan tres cosas:
--   · números con punto decimal   → '72.09'
--   · números con coma decimal    → '66,91'   (cargas del V CDS)
--   · códigos de estado           → 'ELM', 'NSP', 'Ret', 'RET', '-', ''
--
-- Consecuencia real: el desempate del Art. 238.2 se resuelve POR TIEMPO, y
-- comparar '66,91' contra '72.09' como texto da un orden incorrecto. Un podio
-- mal calculado sin que nadie lo note.
--
-- QUÉ HACE
-- 1. Respalda la tabla completa antes de tocar nada.
-- 2. Crea la columna `estado` (ELM / RET / NSP / NULL) y muda los códigos ahí.
--    El nombre no es inventado: la tabla legacy `resultados` ya usa `estado`.
-- 3. Unifica 'Ret' y 'RET' → 'RET'.
-- 4. Pasa las comas decimales a punto y vacía los '' y '-' a NULL.
-- 5. Convierte tiempo/ft/total a numeric y puesto a integer.
--
-- QUÉ **NO** TOCA
-- La columna `obs` queda EXACTAMENTE como está. No es una columna de
-- observaciones limpia — guarda faltas ('4', '11') y códigos mezclados — pero
-- admin.html cuenta las participaciones con `obs != 'NSP'`. Vaciarla rompería
-- el conteo de participación. Se deja intacta a propósito.
--
-- ANTES DE CORRER ESTO
-- Verificado contra la base el 2026-08-10: 449 filas, columnas tiempo/ft/total/
-- puesto de tipo text, valores no numéricos = ELM, NSP, Ret, RET, '-', '' y NULL.
--
-- DESPUÉS DE CORRER ESTO
-- Hay que desplegar el cambio del frontend en el mismo movimiento. Los 12
-- eliminados se muestran hoy porque `total` CONTIENE el texto 'ELM'. Al mudarlo
-- a `estado`, las páginas que hacen `${r.total}` mostrarían un guion en blanco:
--   · jinete_perfil.html   (faltas: r.total)
--   · caballo_perfil.html  (faltas: r.total)
--   · ranking_cds_2026.html
--   · admin.html
-- Cada una tiene que mostrar `estado` cuando existe y `total` cuando no.
-- ════════════════════════════════════════════════════════

BEGIN;

-- ─── 0. RESPALDO ────────────────────────────────────────
-- Copia completa. Si algo sale mal, se vuelve atrás con:
--   BEGIN; DROP TABLE resultados_pdf;
--   ALTER TABLE resultados_pdf_backup_20260810 RENAME TO resultados_pdf; COMMIT;
-- (revisar índices y policies después de un rollback así)
DROP TABLE IF EXISTS resultados_pdf_backup_20260810;
CREATE TABLE resultados_pdf_backup_20260810 AS SELECT * FROM resultados_pdf;

-- ─── 1. COLUMNA NUEVA ───────────────────────────────────
ALTER TABLE resultados_pdf ADD COLUMN IF NOT EXISTS estado text;

-- ─── 2. MUDAR LOS CÓDIGOS A `estado` ────────────────────
-- Se busca en total → ft → tiempo → obs, en ese orden. El primero que tenga un
-- código gana. 'Ret' y 'RET' quedan unificados por el upper().
-- Se incluye 'E' porque es la abreviatura de eliminado que escribe el juez en
-- la planilla; el parser la reconoce (STATUS_CODES en admin.html) y los perfiles
-- la muestran como estado. Se unifica a 'ELM' en el paso siguiente.
UPDATE resultados_pdf SET estado =
  CASE
    WHEN upper(btrim(coalesce(total , ''))) IN ('ELM','E','NSP','RET') THEN upper(btrim(total))
    WHEN upper(btrim(coalesce(ft    , ''))) IN ('ELM','E','NSP','RET') THEN upper(btrim(ft))
    WHEN upper(btrim(coalesce(tiempo, ''))) IN ('ELM','E','NSP','RET') THEN upper(btrim(tiempo))
    WHEN upper(btrim(coalesce(obs   , ''))) IN ('ELM','E','NSP','RET') THEN upper(btrim(obs))
    ELSE NULL
  END;

UPDATE resultados_pdf SET estado = 'ELM' WHERE estado = 'E';

-- ─── 3. LIMPIAR LOS CAMPOS NUMÉRICOS ────────────────────
-- Coma decimal → punto, y '' → NULL (hoy conviven '' y NULL como "nada").
UPDATE resultados_pdf SET
  tiempo = NULLIF(replace(btrim(coalesce(tiempo, '')), ',', '.'), ''),
  ft     = NULLIF(replace(btrim(coalesce(ft    , '')), ',', '.'), ''),
  total  = NULLIF(replace(btrim(coalesce(total , '')), ',', '.'), ''),
  puesto = NULLIF(btrim(coalesce(puesto, '')), '');

-- Lo que quedó y no es un número se va a NULL: los códigos (ya están en
-- `estado`) y el '-' suelto de la columna ft.
UPDATE resultados_pdf SET tiempo = NULL WHERE tiempo IS NOT NULL AND tiempo !~ '^[0-9]+(\.[0-9]+)?$';
UPDATE resultados_pdf SET ft     = NULL WHERE ft     IS NOT NULL AND ft     !~ '^[0-9]+(\.[0-9]+)?$';
UPDATE resultados_pdf SET total  = NULL WHERE total  IS NOT NULL AND total  !~ '^[0-9]+(\.[0-9]+)?$';
UPDATE resultados_pdf SET puesto = NULL WHERE puesto IS NOT NULL AND puesto !~ '^[0-9]+$';

-- ─── 4. CONVERTIR LOS TIPOS ─────────────────────────────
-- Si alguno de estos ALTER falla, es porque hay una vista que depende de la
-- columna. El error lo dice con nombre y apellido. NO forzar: avisar y revisar.
ALTER TABLE resultados_pdf
  ALTER COLUMN tiempo TYPE numeric  USING tiempo::numeric,
  ALTER COLUMN ft     TYPE numeric  USING ft::numeric,
  ALTER COLUMN total  TYPE numeric  USING total::numeric,
  ALTER COLUMN puesto TYPE integer  USING puesto::integer;

-- ─── 5. CANDADO EN `estado` ─────────────────────────────
ALTER TABLE resultados_pdf DROP CONSTRAINT IF EXISTS resultados_pdf_estado_check;
ALTER TABLE resultados_pdf ADD CONSTRAINT resultados_pdf_estado_check
  CHECK (estado IS NULL OR estado IN ('ELM','RET','NSP'));

COMMIT;

-- PostgREST cachea el schema: sin esto el API sigue devolviendo la forma vieja.
NOTIFY pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════
-- VERIFICACIÓN — correr DESPUÉS, una por una
-- ════════════════════════════════════════════════════════

-- A) No se perdió ninguna fila. Las dos cifras tienen que ser iguales.
-- SELECT (SELECT COUNT(*) FROM resultados_pdf)                  AS ahora,
--        (SELECT COUNT(*) FROM resultados_pdf_backup_20260810)  AS antes;

-- B) Los códigos quedaron todos en `estado`. Esperado según el relevamiento
--    del 10-ago: 12 ELM, 8 RET, 3 NSP.
-- SELECT estado, COUNT(*) FROM resultados_pdf GROUP BY estado ORDER BY 1;

-- C) Ningún código se perdió por el camino. Tiene que dar 0 filas.
-- SELECT b.id, b.jinete, b.caballo, b.tiempo, b.ft, b.total
--   FROM resultados_pdf_backup_20260810 b
--   JOIN resultados_pdf r ON r.id = b.id
--  WHERE (upper(btrim(coalesce(b.total,''))) IN ('ELM','NSP','RET')
--      OR upper(btrim(coalesce(b.ft   ,''))) IN ('ELM','NSP','RET')
--      OR upper(btrim(coalesce(b.tiempo,''))) IN ('ELM','NSP','RET'))
--    AND r.estado IS NULL;

-- D) Ningún tiempo se perdió en la conversión. Tiene que dar 0 filas.
--    (busca filas que ANTES tenían un tiempo numérico y AHORA quedaron en NULL)
-- SELECT b.id, b.jinete, b.caballo, b.tiempo AS antes, r.tiempo AS ahora
--   FROM resultados_pdf_backup_20260810 b
--   JOIN resultados_pdf r ON r.id = b.id
--  WHERE b.tiempo ~ '^[0-9]+([.,][0-9]+)?$' AND r.tiempo IS NULL;

-- E) Los desempates por tiempo ahora ordenan bien. Antes, con texto,
--    '66,91' caía después de '72.09'.
-- SELECT jinete, caballo, total, tiempo
--   FROM resultados_pdf
--  WHERE concurso_id = 5 AND categoria = 'Cuarta Categoría'
--  ORDER BY total NULLS LAST, tiempo NULLS LAST;

-- Cuando A–E den bien y el frontend esté desplegado, se puede borrar el respaldo:
--   DROP TABLE resultados_pdf_backup_20260810;
-- Recomendación: dejarlo hasta después de cargar el VIII y el X.
-- ════════════════════════════════════════════════════════
