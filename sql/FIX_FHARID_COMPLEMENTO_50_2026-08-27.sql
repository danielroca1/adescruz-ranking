-- ============================================================================
-- FIX_FHARID_COMPLEMENTO_50_2026-08-27.sql
--
-- Registra la SEGUNDA transferencia de Fharid Galvis: los Bs 50 que faltaban
-- para completar los Bs 250 de su inscripción al XIII CDS.
--
-- Datos transcritos del comprobante que mandó Daniel el 27-ago-2026:
--
--   Banco emisor      Banco Económico (pago con QR)
--   Importe           Bs 50.00
--   Fecha y hora      18/Ago/2026 18:20:37  (Bolivia, UTC-4)
--   N° de transacción 371387459
--   Cód. autorización 160903
--   Remitente         GALVIS LIMA LOBO MARIA ROSARIO
--   Cuenta origen     CA 1091819000 (Bs)
--   Cuenta destino    2000274154  ← la de ADESCRUZ, SIN enmascarar
--   Motivo            "XIII CDS 2026" · nota del cliente: "inscripción"
--
-- 📌 DATO PARA EL CEREBRO: este comprobante trae la cuenta destino COMPLETA.
-- El enmascaramiento "200****154" que forzó la tercera recalibración es de la
-- app del BNB, no de todos los bancos. El clasificador cubre los dos casos.
--
-- POR QUÉ RESERVAR EL N° DE OPERACIÓN, y no solo anotarlo:
-- `operaciones_consumidas` es lo único que impide que el mismo comprobante se
-- use dos veces. El de los Bs 200 (371371795) ya estaba reservado; este NO,
-- así que hoy alguien podría subir esta misma captura en otra inscripción y el
-- sistema no lo notaría. Un pago registrado a medias no protege nada.
--
-- ⚠️ EL N° ESTÁ TRANSCRITO A OJO DE UNA IMAGEN. Si algún dígito quedó mal, la
-- consecuencia es que un pago futuro con ese número real se marcaría como
-- reúso. Se deshace con un DELETE de esa fila.
--
-- Idempotente: `on conflict do nothing` y un UPDATE que no vuelve a aplicarse.
-- ============================================================================

-- ─── PASO 1: preview ───────────────────────────────────────────────────────
select 'ANTES' as momento, i.nombre, i.monto_esperado, i.monto_pagado,
       (select string_agg(oc.nro_operacion, ', ' order by oc.nro_operacion)
          from operaciones_consumidas oc where oc.ref_id = i.id) as ops_reservadas
  from inscripciones i where i.nombre = 'Fharid Galvis';

-- ─── PASO 2: reservar el N° del complemento (anti-reúso) ───────────────────
insert into operaciones_consumidas (nro_operacion, origen, ref_id)
select '371387459', 'inscripcion', i.id
  from inscripciones i where i.nombre = 'Fharid Galvis'
on conflict (nro_operacion) do nothing;

-- ─── PASO 3: dejar los datos del complemento en la nota ────────────────────
-- Reemplaza el "PENDIENTE adjuntar" que dejó FIX_MONTO_PAGADO por el detalle
-- real. La imagen se sube aparte al bucket `comprobantes` (comprobante_url
-- guarda una sola URL y esa es la del pago de Bs 200).
update inscripciones
   set nota_admin = replace(
         nota_admin,
         'PENDIENTE adjuntar el comprobante de los 50.',
         'Complemento de Bs 50 verificado: Banco Economico QR, 18-ago-2026 18:20:37, '
         || 'N de transaccion 371387459, cod. autorizacion 160903, remitente GALVIS LIMA LOBO MARIA ROSARIO, '
         || 'a la cuenta 2000274154. N reservado en operaciones_consumidas.')
 where nombre = 'Fharid Galvis'
   and nota_admin like '%PENDIENTE adjuntar el comprobante de los 50.%';

-- ─── PASO 4: verificación ──────────────────────────────────────────────────
select 'DESPUES' as momento, i.nombre, i.monto_esperado, i.monto_pagado,
       (select string_agg(oc.nro_operacion, ', ' order by oc.nro_operacion)
          from operaciones_consumidas oc where oc.ref_id = i.id) as ops_reservadas,
       (i.nota_admin like '%PENDIENTE%') as sigue_pendiente
  from inscripciones i where i.nombre = 'Fharid Galvis';

select 'TOTAL OPS' as que, count(*) as reservadas from operaciones_consumidas;
