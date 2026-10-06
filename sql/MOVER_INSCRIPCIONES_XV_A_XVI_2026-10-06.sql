-- ============================================================================
-- MOVER_INSCRIPCIONES_XV_A_XVI_2026-10-06.sql
--
-- El XV CDS (3-4 oct) se canceló por mal tiempo. Decisión de Daniel (6-oct-2026):
-- sus inscriptos pasan al XVI (10-11 oct), con el mismo comprobante y el mismo
-- estado. Se MUEVEN (no se copian) y pasan todas MENOS las rechazadas.
--
-- Por qué mover y no copiar: el anti-reúso (`operaciones_consumidas`) guarda el
-- N° de operación de cada pago aprobado apuntando al id de la inscripción. Al
-- mover, el id no cambia y la reserva sigue siendo de la misma fila. Una copia
-- tendría otro id y el trigger la frenaría como «comprobante repetido» al aprobarla.
--
-- Qué NO toca: `estado` (el único trigger de UPDATE de inscripciones está scopeado
-- a esa columna, así que no se dispara), el comprobante, el N° de operación ni la
-- glosa. Las rechazadas quedan en el XV.
--
-- Correr en el SQL Editor de Supabase, UN PASO POR VEZ, en orden.
-- ============================================================================


-- ─── PASO 1: mirar (no cambia nada) ─────────────────────────────────────────
-- 1a. Los dos concursos existen y su estado.
select numero, nombre, fecha_sab, fecha_dom, estado, inscripciones_abiertas, glosa_esperada
  from campeonatos
 where temporada = 2026 and numero in (15, 16)
 order by numero;

-- 1b. Cuántas hay en cada concurso, por estado.
select concurso_id, coalesce(estado, '(sin estado)') as estado, count(*) as cantidad
  from inscripciones
 where concurso_id in ('XV-CDS-2026', 'XVI-CDS-2026')
 group by 1, 2
 order by 1, 2;

-- 1c. Las que se van a mover.
select nombre, equino, cat_concurso, dias, estado, nro_operacion, created_at
  from inscripciones
 where concurso_id = 'XV-CDS-2026'
   and coalesce(estado, '') <> 'rechazada'
 order by nombre, equino;

-- 1d. Posibles duplicados: el mismo binomio en la misma categoría ya inscripto
--     en el XVI. Si sale alguno, NO seguir: avisar antes de mover.
select x.nombre, x.equino, x.cat_concurso,
       x.estado as estado_en_xv, y.estado as estado_en_xvi, y.created_at as inscripto_en_xvi
  from inscripciones x
  join inscripciones y
    on y.concurso_id = 'XVI-CDS-2026'
   and lower(trim(y.nombre))       = lower(trim(x.nombre))
   and lower(trim(y.equino))       = lower(trim(x.equino))
   and lower(trim(y.cat_concurso)) = lower(trim(x.cat_concurso))
 where x.concurso_id = 'XV-CDS-2026'
   and coalesce(x.estado, '') <> 'rechazada';


-- ─── PASO 2: respaldo (crea una tabla con cómo estaban) ─────────────────────
create table if not exists _respaldo_mover_xv_xvi_20261006 as
select id, concurso_id, nota_admin, now() as respaldado_en
  from inscripciones
 where concurso_id = 'XV-CDS-2026'
   and coalesce(estado, '') <> 'rechazada';

select count(*) as filas_respaldadas from _respaldo_mover_xv_xvi_20261006;


-- ─── PASO 3: mover ──────────────────────────────────────────────────────────
update inscripciones i
   set concurso_id = 'XVI-CDS-2026',
       nota_admin  = coalesce(i.nota_admin || ' | ', '') ||
                     'Movida del XV al XVI el 6-oct-2026: el XV se cancelo por mal tiempo.'
  from _respaldo_mover_xv_xvi_20261006 r
 where i.id = r.id
   and i.concurso_id = 'XV-CDS-2026';


-- ─── PASO 4: verificar ──────────────────────────────────────────────────────
select concurso_id, coalesce(estado, '(sin estado)') as estado, count(*) as cantidad
  from inscripciones
 where concurso_id in ('XV-CDS-2026', 'XVI-CDS-2026')
 group by 1, 2
 order by 1, 2;

select (select count(*) from _respaldo_mover_xv_xvi_20261006)                    as respaldadas,
       (select count(*) from inscripciones i join _respaldo_mover_xv_xvi_20261006 r
          on r.id = i.id where i.concurso_id = 'XVI-CDS-2026')                 as ahora_en_xvi;
-- Las dos cifras tienen que ser iguales.


-- ─── DESHACER (solo si hace falta) ──────────────────────────────────────────
-- update inscripciones i
--    set concurso_id = r.concurso_id,
--        nota_admin  = r.nota_admin
--   from _respaldo_mover_xv_xvi_20261006 r
--  where i.id = r.id;
