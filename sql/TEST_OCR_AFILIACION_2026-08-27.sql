-- ============================================================================
-- TEST_OCR_AFILIACION_2026-08-27.sql
--
-- Prueba end-to-end del OCR de comprobantes tras arreglar el bug de
-- `CLAUDE_API is not defined` (validar-comprobante v16 / -afiliacion v10).
--
-- POR QUÉ AFILIACIONES Y NO INSCRIPCIONES:
--   `inscripciones` tiene `on-inscripcion-insert` PRENDIDO → correos reales.
--   `afiliaciones` tiene `on-afiliacion-insert` APAGADO (verificado contra
--   pg_trigger hoy) → cero correos. Las dos funciones comparten
--   `_shared/validacion-pagos.ts`, así que probar una prueba el OCR de las dos.
--
-- POR QUÉ NO PUEDE TERMINAR EN 'aprobada' (garantía por construcción):
--   `site_config.afiliacion_glosa_esperada` = 'Afiliacion ADESCRUZ 2026', y el
--   comprobante que usamos es de una INSCRIPCIÓN (glosa 'XIII CDS 2026'). El
--   mismatch de glosa es inevitable → balde blando → `revision_manual`.
--   Importa porque el trigger `on_afiliacion_aprobada_consumir_op` (AFTER
--   UPDATE OF estado, PRENDIDO) reservaría el N° de operación de un
--   comprobante REAL de otro jinete en `operaciones_consumidas`.
--
-- El comprobante se REFERENCIA, no se copia: es el de Alina Arce, ya en el
-- bucket. La fila de prueba se borra al final (paso 3).
-- ============================================================================

-- ─── PASO 1: preview — estado previo ───────────────────────────────────────
select 'ANTES' as momento,
       (select count(*) from afiliaciones where temporada = 1900) as filas_prueba,
       (select count(*) from operaciones_consumidas)              as ops_consumidas;

-- ─── PASO 2: insertar la fila de prueba (idempotente) ──────────────────────
insert into afiliaciones (id, temporada, nombre, email, celular, club, estado, comprobante_url, nota_admin)
select '00000000-1900-4000-8000-000000000001', 1900,
       'ZZ TEST OCR - BORRAR', 'daniel.roca.s@gmail.com', '00000000',
       'TEST', 'pendiente', 'inscripciones/1787869824091_Alina_Arce.png',
       'Fila de prueba del OCR (27-ago-2026). Se borra en el paso 3.'
where not exists (select 1 from afiliaciones where id = '00000000-1900-4000-8000-000000000001');

select 'INSERTADA' as momento, id::text, nombre, estado, comprobante_url
  from afiliaciones where temporada = 1900;

-- ─── PASO 3: borrar la fila de prueba ──────────────────────────────────────
-- `afiliaciones` no tiene triggers de DELETE (los dos son INSERT y
-- AFTER UPDATE OF estado), así que el borrado no dispara nada.
delete from afiliaciones where id = '00000000-1900-4000-8000-000000000001';

select 'DESPUES' as momento,
       (select count(*) from afiliaciones where temporada = 1900) as filas_prueba,
       (select count(*) from operaciones_consumidas)              as ops_consumidas;

-- RESULTADO DEL TEST (27-ago-2026, 18:45 Bolivia):
--   ✅ El OCR CORRE. Leyó: monto 250, moneda BOB, fecha 2026-08-27,
--      banco BNB, titular destino "BEDOYA ALIPAZ NICOLAS", confianza 0.95.
--      El bug de CLAUDE_API está arreglado y verificado end-to-end.
--   ⚠️ Pero el veredicto fue `rechazada`, y NO por la glosa como se preveía:
--      el banco imprime la cuenta destino ENMASCARADA -> "200****154".
--      Ver hallazgos en el reporte al respecto.
