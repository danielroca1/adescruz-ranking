-- ============================================================================
-- FIX_WETEL_A_WETTEL_2026-08-27.sql
--
-- Corrige el typo que estaba EN LA BASE: el caballo se llama `Wettel`, con dos
-- T, y la base lo tenía como `Wetel`.
--
-- POR QUÉ AHORA, Y NO ANTES: el pendiente estaba anotado desde hace semanas
-- pero con una sola fuente — la planilla del juez y el orden de ingreso dicen
-- `Wettel`. En su momento se respetó la grafía de la base para no partir el
-- historial. Hoy (27-ago-2026) apareció la segunda fuente independiente: la
-- madre de Camila Mamani lo inscribió al XIII CDS escribiendo `Wettel`, y el
-- admin la "corrigió" hacia `Wetel` para que los puntos contaran.
--
-- O sea: la familia del caballo y el juez escriben lo mismo, y el único lugar
-- del mundo donde el caballo se llama `Wetel` es nuestra base. Con dos fuentes
-- coincidiendo contra cero, el typo es nuestro. Daniel autorizó corregirlo.
--
-- ⚠️ HAY QUE TOCAR LAS CINCO TABLAS A LA VEZ. Cambiar solo `caballos` deja
-- huérfanas las 5 filas de `resultados_pdf` y rompe el match de la inscripción
-- que Daniel acababa de corregir a mano. Es la misma trampa de `Ydalina Rex`.
--
-- ⚠️ Y OJO CON LAS MAYÚSCULAS: `afiliacion_caballos` tiene 2 filas como `WETEL`
-- (la convención de la carga histórica 2024/2025, que va en mayúsculas) y 1
-- como `Wetel` (2026, en Título). Se preserva cada convención: `WETTEL` y
-- `Wettel` respectivamente. Reemplazar en bloque rompería esa distinción, que
-- es justo el error contra el que advierte el pendiente de unificación.
--
-- Verificado antes de escribir: `caballos`, `resultados_pdf`,
-- `ranking_historico` y `afiliacion_caballos` no tienen ningún trigger; el
-- único trigger de UPDATE de `inscripciones` está scopeado a `estado`, que no
-- se toca. Cero correos.
-- Idempotente: la segunda corrida no encuentra filas.
-- ============================================================================

-- ─── PASO 1: preview ───────────────────────────────────────────────────────
select 'ANTES' as momento, 'caballos' as tabla, nombre as valor, count(*) as n from caballos where nombre ilike 'wet%el' group by nombre
union all select 'ANTES','resultados_pdf', caballo, count(*) from resultados_pdf where caballo ilike 'wet%el' group by caballo
union all select 'ANTES','ranking_historico', caballo, count(*) from ranking_historico where caballo ilike 'wet%el' group by caballo
union all select 'ANTES','inscripciones', equino, count(*) from inscripciones where equino ilike 'wet%el' group by equino
union all select 'ANTES','afiliacion_caballos', nombre_caballo, count(*) from afiliacion_caballos where nombre_caballo ilike 'wet%el' group by nombre_caballo;

-- ─── PASO 2: el padrón ─────────────────────────────────────────────────────
-- Guard por si la grafía nueva ya existiera: sería una fusión, no un renombre.
update caballos
   set nombre = 'Wettel'
 where nombre = 'Wetel'
   and not exists (select 1 from caballos c2 where c2.nombre = 'Wettel');

-- ─── PASO 3: el historial de resultados (5 filas) ──────────────────────────
update resultados_pdf set caballo = 'Wettel' where caballo = 'Wetel';

-- ─── PASO 4: el ranking histórico ──────────────────────────────────────────
update ranking_historico set caballo = 'Wettel' where caballo = 'Wetel';

-- ─── PASO 5: la inscripción viva del XIII ──────────────────────────────────
-- Camila Mamani. Si esto no se mueve, la corrección manual que hizo Daniel
-- hace un rato queda apuntando a una ficha que ya no existe.
update inscripciones
   set equino = 'Wettel',
       nota_admin = coalesce(nota_admin || ' | ', '') ||
                    'El caballo se llama Wettel con dos T: el typo estaba en la base, no en la inscripcion. La grafia original de esta inscripcion era la correcta.'
 where equino = 'Wetel';

-- ─── PASO 6: afiliaciones, respetando la convención de cada temporada ──────
update afiliacion_caballos set nombre_caballo = 'WETTEL' where nombre_caballo = 'WETEL';
update afiliacion_caballos set nombre_caballo = 'Wettel' where nombre_caballo = 'Wetel';

-- ─── PASO 7: verificación ──────────────────────────────────────────────────
select 'DESPUES' as momento,
       (select count(*) from caballos            where nombre = 'Wetel')          as caballos_viejo,
       (select count(*) from caballos            where nombre = 'Wettel')         as caballos_nuevo,
       (select count(*) from resultados_pdf      where caballo = 'Wetel')         as resultados_viejo,
       (select count(*) from resultados_pdf      where caballo = 'Wettel')        as resultados_nuevo,
       (select count(*) from ranking_historico   where caballo = 'Wettel')        as historico_nuevo,
       (select count(*) from inscripciones       where equino = 'Wettel')         as inscripcion_nueva,
       (select count(*) from afiliacion_caballos where nombre_caballo ilike 'wettel') as afiliaciones_nuevo;

-- Ninguna fila de resultados ni de inscripciones puede quedar sin ficha.
select 'HUERFANOS resultados' as chequeo, count(*) as filas
  from resultados_pdf r where r.caballo = 'Wettel'
   and not exists (select 1 from caballos c where c.nombre = r.caballo);

select 'HUERFANOS inscripciones' as chequeo, count(*) as filas
  from inscripciones i where i.concurso_id = 'XIII-CDS-2026'
   and not exists (select 1 from caballos c where c.nombre = i.equino);
