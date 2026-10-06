-- ============================================================================
-- FIX_NRO_OPERACION_BCP_FRANCISCA_ROCA_2026-10-06.sql
--
-- Inscripción de Francisca Roca (Tyson, Futuros Campeones, XVI CDS), aprobada
-- sola el 6-oct-2026. El comprobante del BCP dice «Número de transacción
-- 072610060103672» (15 dígitos). Las dos lecturas del OCR guardaron
-- 0726100600103672 (16): la guía del lector pedía 16 dígitos y el modelo agregó
-- un cero. Ese número falso quedó reservado en `operaciones_consumidas`, así que
-- el anti-reúso no reconocería el comprobante real si se volviera a subir.
--
-- Se corrige el N° en la reserva y en la inscripción. No se toca `estado` (el
-- trigger de UPDATE de inscripciones está scopeado a esa columna).
-- ============================================================================
begin;

update operaciones_consumidas
   set nro_operacion = '072610060103672'
 where nro_operacion = '0726100600103672';

update inscripciones
   set nro_operacion = '072610060103672',
       nota_admin    = coalesce(nota_admin || ' | ', '') ||
                       'N de operacion corregido 6-oct-2026: el OCR habia guardado 0726100600103672 (un cero de mas); el comprobante dice 072610060103672.'
 where nro_operacion = '0726100600103672'
   and concurso_id   = 'XVI-CDS-2026';

commit;

select
  (select count(*) from operaciones_consumidas where nro_operacion = '072610060103672')  as reserva_corregida,
  (select count(*) from operaciones_consumidas where nro_operacion = '0726100600103672') as reserva_vieja,
  (select count(*) from inscripciones          where nro_operacion = '072610060103672')  as inscripcion_corregida;
-- Tiene que dar 1, 0, 1.
