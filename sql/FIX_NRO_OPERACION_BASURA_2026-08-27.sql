-- ============================================================================
-- FIX_NRO_OPERACION_BASURA_2026-08-27.sql
--
-- DESBLOQUEA LAS APROBACIONES DEL XIII CDS.
--
-- El OCR leyó el texto de la glosa ("XIII CDS 2026") y lo puso en
-- `nro_operacion`, dejando `glosa` en null. Al aprobar a mano esa inscripción,
-- el trigger `consumir_operacion_al_aprobar` reservó esa cadena en
-- `operaciones_consumidas` como si fuera un número de operación.
--
-- POR QUÉ BLOQUEA: leído el código del trigger, ante choque de PK con otro
-- dueño hace `raise exception`, NO lo ignora. La próxima inscripción cuyo
-- comprobante el OCR lea igual va a traer el mismo `nro_operacion`, y el ✓ del
-- admin va a FALLAR con un error de reúso. No es que apruebe mal: no se puede
-- aprobar. Con el CDS en dos días.
--
-- "XIII CDS 2026" no es un número de operación de nadie: es la glosa que
-- comparten TODOS los pagos de este concurso. Como reserva de anti-reúso no
-- protege nada — solo bloquea al segundo que pague.
-- ============================================================================

-- ─── PASO 1: preview ───────────────────────────────────────────────────────
select 'ANTES' as momento, oc.nro_operacion, oc.origen, oc.ref_id::text,
       i.nombre, i.estado, i.glosa
  from operaciones_consumidas oc
  left join inscripciones i on i.id = oc.ref_id
 where oc.nro_operacion !~ '^[0-9]+$';

-- ─── PASO 2: soltar la reserva basura ──────────────────────────────────────
delete from operaciones_consumidas
 where nro_operacion = 'XIII CDS 2026';

-- ─── PASO 3: reparar la fila que la originó ────────────────────────────────
-- El valor es la glosa, no el N° de operación: se mueve a su columna.
-- El N° real nunca se capturó (el OCR no lo leyó), así que queda null: es más
-- honesto que dejar un número de operación falso.
-- No toca `estado`, así que el trigger (scopeado a esa columna) no se dispara.
update inscripciones
   set glosa          = coalesce(glosa, nro_operacion),
       nro_operacion  = null,
       nota_admin     = coalesce(nota_admin || ' | ', '') ||
                        'N de operacion corregido 27-ago: el OCR habia guardado la glosa ("XIII CDS 2026") como N de operacion y eso bloqueaba las aprobaciones siguientes.'
 where nro_operacion = 'XIII CDS 2026';

-- ─── PASO 4: verificación ──────────────────────────────────────────────────
select 'DESPUES' as momento,
       (select count(*) from operaciones_consumidas where nro_operacion !~ '^[0-9]+$') as reservas_basura,
       (select count(*) from operaciones_consumidas)                                    as ops_total,
       (select count(*) from inscripciones where nro_operacion = 'XIII CDS 2026')       as filas_con_basura;

select 'FILA REPARADA' as que, nombre, estado, glosa, nro_operacion
  from inscripciones where id = '4fa481d7-a33f-4987-9fa1-fcb5dc4c20e5';
