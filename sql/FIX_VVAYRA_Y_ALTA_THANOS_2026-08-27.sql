-- ============================================================================
-- FIX_VVAYRA_Y_ALTA_THANOS_2026-08-27.sql
--
-- Dos cosas del XIII CDS, decididas por Daniel el 27-ago-2026:
--
-- 1. GRAFÍA DE VVAYRA — se queda "Sisik", con eses comunes.
--
--    `ranking_historico` (2025) la tenía como "Vvayra Meryem Şişik", con las
--    eses turcas (U+015E / U+015F). Ella se inscribió como "Sisik".
--
--    ⚠️ ES UNA EXCEPCIÓN DELIBERADA a la regla vigente, y por eso queda escrita.
--    La regla dice que el canonical sale de `jinetes` + `ranking_historico`, y
--    acá solo existe el segundo → habría ganado "Şişik". Daniel decidió lo
--    contrario por una razón práctica: es un nombre que nadie va a escribir bien
--    nunca, ni ella misma, así que cada planilla de juez y cada formulario
--    volvería a generar una variante nueva. Se elige la grafía que la gente SÍ
--    puede tipear.
--
-- 2. ALTA DE `Thanos` — caballo genuinamente nuevo, no un problema de búsqueda.
--    No existía en `caballos` con ninguna grafía (se verificó por similitud, no
--    por igualdad). Club tomado de la inscripción: Santa Cruz International
--    School (SCIS), con la grafía canónica que ya usan los otros caballos del
--    club.
--
-- Verificado antes de escribir: `caballos` y `ranking_historico` no tienen
-- ningún trigger; el único trigger de UPDATE de `inscripciones` está scopeado a
-- la columna `estado`, que este script no toca. Cero correos.
-- Idempotente: guardas `not exists` y UPDATEs que no vuelven a aplicarse.
-- ============================================================================

-- ─── PASO 1: preview ───────────────────────────────────────────────────────
select 'ranking_historico' as tabla, jinete as valor, temporada::text as extra
  from ranking_historico where jinete ilike '%sisik%' or jinete ilike '%şişik%'
union all
select 'caballos', nombre, club from caballos where nombre ilike '%thanos%'
union all
select 'inscripcion', nombre, equino || ' (equino_libre=' || equino_libre || ')'
  from inscripciones where concurso_id='XIII-CDS-2026' and nombre ilike '%sisik%';

-- ─── PASO 2: unificar la grafía en el histórico ────────────────────────────
update ranking_historico
   set jinete = 'Vvayra Meryem Sisik'
 where jinete <> 'Vvayra Meryem Sisik'
   and jinete ilike '%vvayra%';

-- ─── PASO 3: alta de Thanos ────────────────────────────────────────────────
-- El guard evita crear un duplicado si el caballo ya entrara por otra vía
-- (p. ej. el backfill que corre al cargar los resultados del CDS).
insert into caballos (nombre, club, activo)
select 'Thanos', 'Santa Cruz International School (SCIS)', true
 where not exists (select 1 from caballos where nombre = 'Thanos');

-- ─── PASO 4: la inscripción ya no tiene el equino "escrito a mano" ─────────
-- Ahora Thanos existe en el padrón, así que el flag dejó de ser cierto.
-- OJO: `nombre_libre` se deja como está a propósito — Vvayra sigue SIN ficha
-- en `jinetes`, así que el flag describe la realidad: no la eligió de la lista
-- porque no estaba. Se limpia recién si se le crea la ficha.
update inscripciones
   set equino_libre = false,
       nota_admin = coalesce(nota_admin || ' | ', '') ||
                    'Thanos dado de alta en caballos el 27-ago (club SCIS, tomado de la inscripcion). Grafia del jinete fijada como "Sisik" sin eses turcas por decision de Daniel: excepcion deliberada a la regla del canonical, porque "Sisik" es la que la gente puede escribir.'
 where concurso_id = 'XIII-CDS-2026'
   and nombre ilike '%sisik%'
   and equino = 'Thanos'
   and equino_libre;

-- ─── PASO 5: verificación ──────────────────────────────────────────────────
select 'DESPUES' as momento,
       (select count(*) from ranking_historico where jinete = 'Vvayra Meryem Sisik')   as historico_ok,
       (select count(*) from ranking_historico where jinete ilike '%şişik%')           as quedan_turcas,
       (select count(*) from caballos where nombre = 'Thanos')                          as thanos_alta,
       (select count(*) from inscripciones where concurso_id='XIII-CDS-2026' and equino_libre) as equinos_a_mano,
       (select count(*) from inscripciones where concurso_id='XIII-CDS-2026' and nombre_libre) as nombres_a_mano;

select 'THANOS' as que, nombre, club, activo from caballos where nombre = 'Thanos';
