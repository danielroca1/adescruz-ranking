-- ============================================================================
-- FIX_NOMBRE_SARAH_VIERA_2026-08-27.sql
--
-- La mamá de Sarah inscribió al XIII CDS escribiendo "Sarah Viera Wende" (el
-- nombre legal, con el apellido materno) en vez de "Sarah Viera", que es la
-- grafía del padrón y del ranking. Quedó con `nombre_libre = true`.
--
-- POR QUÉ NO ES COSMÉTICO: el ranking atribuye los puntos por el NOMBRE. Una
-- inscripción a nombre de "Sarah Viera Wende" genera resultados que no
-- matchean con "Sarah Viera", así que los puntos del XIII no se le sumarían a
-- su ficha — se perderían en un jinete fantasma que nadie creó a propósito.
--
-- Identidad confirmada por tres vías independientes, no por parecido de nombre:
--   · `jinetes`      → Sarah Viera, club SCIS
--   · `ranking_historico` y `resultados_pdf` → Sarah Viera
--   · el caballo     → Chanel LV es SU caballo: 10 filas, 36 pts, todas en
--                      Pre Infantil, todas con ella arriba
--   · la categoría   → su categoría oficial es Pre Infantil, la misma en la
--                      que se inscribió
--
-- ⚠️ Ojo con `Chanel LV`: NO es el mismo caballo que `Canela` ni que
-- `Dolce Chanel Du Rozel`. Son falsos positivos confirmados y no se fusionan.
--
-- Verificado: el único trigger de UPDATE de `inscripciones` está scopeado a la
-- columna `estado`, que este script no toca. Cero correos.
-- Idempotente: la segunda corrida no encuentra filas.
-- ============================================================================

-- ─── PASO 1: preview ───────────────────────────────────────────────────────
select 'ANTES' as momento, nombre, nombre_libre, equino, cat_concurso, estado
  from inscripciones
 where concurso_id = 'XIII-CDS-2026' and nombre ilike '%viera%';

-- ─── PASO 2: corregir al nombre del ranking ────────────────────────────────
update inscripciones
   set nombre       = 'Sarah Viera',
       nombre_libre = false,
       nota_admin   = coalesce(nota_admin || ' | ', '') ||
                      'Nombre corregido el 27-ago: se inscribio como "Sarah Viera Wende" (nombre legal) y el padron y el ranking usan "Sarah Viera". Sin corregir, los puntos del XIII no se le habrian sumado a su ficha. Identidad confirmada por club (SCIS), caballo (Chanel LV, 10 filas suyas) y categoria (Pre Infantil).'
 where concurso_id = 'XIII-CDS-2026'
   and nombre = 'Sarah Viera Wende';

-- ─── PASO 3: verificación ──────────────────────────────────────────────────
select 'DESPUES' as momento, i.nombre, i.nombre_libre, i.equino, i.cat_concurso, i.estado,
       exists (select 1 from jinetes j where j.nombre = i.nombre) as matchea_padron
  from inscripciones i
 where i.concurso_id = 'XIII-CDS-2026' and i.nombre ilike '%viera%';

-- Cuántas inscripciones del XIII siguen con el nombre escrito a mano.
select 'NOMBRES A MANO' as chequeo, nombre, equino
  from inscripciones where concurso_id = 'XIII-CDS-2026' and nombre_libre;
