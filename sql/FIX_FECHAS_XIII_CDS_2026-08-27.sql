-- ============================================================================
-- FIX_FECHAS_XIII_CDS_2026-08-27.sql
--
-- Reprograma el XIII CDS a su fecha nueva: sábado 29 y domingo 30 de agosto
-- de 2026 (Daniel, 27-ago-2026). El concurso se había postergado por lluvia el
-- 20-ago y las fechas quedaron congeladas en el 22–23, que ya pasaron: el
-- calendario público anunciaba un concurso que no iba a ocurrir.
--
-- Mueve TAMBIÉN `cierre_fecha`, que es lo que se olvida: el default del sistema
-- es el viernes anterior a las 15:00 hora de Bolivia (UTC-4), o sea el
-- 2026-08-28 15:00 local = 2026-08-28 19:00 UTC.
--
-- ⚠️ NO toca `cierre_activo`, que sigue en `false` desde la postergación.
-- Reactivarlo es una decisión aparte porque dispara el correo al jurado con el
-- Excel del cron, que hoy NO cumple las reglas de orden de ingreso. Se
-- consulta con Daniel antes de prenderlo.
--
-- Contexto del chequeo de cierre: la Edge Function v19 ya no compara contra
-- `cierre_fecha` sino contra `cierre_ejecutado_en`, así que aunque esta fecha
-- quede vieja otra vez no vuelve a frenar pagos legítimos. Igual se actualiza,
-- porque es la que usa el cron para decidir cuándo cerrar.
--
-- Idempotente: la segunda corrida no encuentra filas que cambiar.
-- ============================================================================

-- ─── PASO 1: preview ───────────────────────────────────────────────────────
select 'ANTES' as momento, numero, fecha_sab, fecha_dom, estado,
       inscripciones_abiertas, cierre_activo, cierre_fecha, cierre_ejecutado_en
  from campeonatos where temporada = 2026 and numero = 13;

-- ─── PASO 2: reprogramar ───────────────────────────────────────────────────
update campeonatos
   set fecha_sab    = date '2026-08-29',
       fecha_dom    = date '2026-08-30',
       -- viernes anterior 15:00 Bolivia (UTC-4) = 19:00 UTC
       cierre_fecha = timestamptz '2026-08-28 19:00:00+00',
       nota         = coalesce(nullif(nota,'') || ' | ', '') ||
                      'Reprogramado el 27-ago-2026 al 29-30 de agosto tras la postergacion por lluvia del 20-ago. Cierre movido al viernes 28 a las 15:00 Bolivia.'
 where temporada = 2026 and numero = 13
   and (fecha_sab is distinct from date '2026-08-29'
     or fecha_dom is distinct from date '2026-08-30'
     or cierre_fecha is distinct from timestamptz '2026-08-28 19:00:00+00');

-- ─── PASO 3: verificación ──────────────────────────────────────────────────
select 'DESPUES' as momento, numero, fecha_sab, fecha_dom, estado,
       inscripciones_abiertas, cierre_activo,
       cierre_fecha,
       (cierre_fecha at time zone 'America/La_Paz') as cierre_hora_bolivia,
       cierre_fecha > now() as cierre_en_el_futuro,
       cierre_ejecutado_en
  from campeonatos where temporada = 2026 and numero = 13;
