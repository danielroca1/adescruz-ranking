-- ============================================================================
-- FIX_MOTIVO_RECHAZO_OCR_2026-08-27.sql
--
-- Limpia el `motivo_rechazo` que dejó el bug de `CLAUDE_API is not defined`
-- (20 al 27-ago-2026). En el admin esas filas mostraban "✓ Aprobada" con un
-- "Error OCR: CLAUDE_API is not defined" en rojo debajo: el estado era
-- correcto — Daniel las verificó a mano contra el comprobante — pero el
-- mensaje del validador roto seguía escrito y se leía como un problema.
--
-- ALCANCE DELIBERADAMENTE ESTRECHO: solo las filas cuyo motivo contiene
-- 'CLAUDE_API'. No toca los `motivo_rechazo` legítimos que escribe el
-- validador cuando de verdad encuentra algo (p.ej. la cuenta enmascarada).
--
-- NO TOCA `estado` (así el trigger `on_inscripcion_aprobada_consumir_op`, que
-- está scopeado a esa columna, no se dispara — verificado en pg_trigger.tgattr)
-- NI `validacion_ocr` (se conserva como audit trail de qué pasó).
-- Idempotente: la segunda corrida no encuentra filas.
-- ============================================================================

-- ─── PASO 1: preview ───────────────────────────────────────────────────────
select 'ANTES' as momento, id::text, nombre, estado, motivo_rechazo,
       validacion_ocr->>'error' as ocr_error_conservado
  from inscripciones
 where motivo_rechazo like '%CLAUDE_API%'
 order by created_at;

-- ─── PASO 2: limpiar ───────────────────────────────────────────────────────
update inscripciones
   set motivo_rechazo = null
 where motivo_rechazo like '%CLAUDE_API%';

-- ─── PASO 3: verificación ──────────────────────────────────────────────────
select 'DESPUES' as momento,
       (select count(*) from inscripciones where motivo_rechazo like '%CLAUDE_API%')  as quedan_con_mensaje,
       (select count(*) from inscripciones where validacion_ocr ? 'error')            as audit_trail_intacto,
       (select count(*) from inscripciones where validacion_ocr ? 'error'
                                             and estado = 'aprobada')                 as siguen_aprobadas;
