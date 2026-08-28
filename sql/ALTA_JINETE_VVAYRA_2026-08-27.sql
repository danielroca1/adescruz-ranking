-- ============================================================================
-- ALTA_JINETE_VVAYRA_2026-08-27.sql
--
-- Crea la ficha de Vvayra Meryem Sisik en `jinetes`. Competía en 2025 (está en
-- `ranking_historico`) y se inscribió al XIII CDS 2026, pero nunca había
-- entrado al padrón.
--
-- POR QUÉ IMPORTA, más allá de la prolijidad: el buscador del formulario de
-- inscripción consulta `jinetes`. Mientras no tenga ficha, ella es INVISIBLE
-- para el autocompletado, así que en cada concurso va a tener que escribir su
-- nombre a mano — y un nombre escrito a mano que no matchea es un jinete
-- fantasma al que se le van los puntos. El alta corta ese ciclo.
--
-- Datos tomados de su propia inscripción al XIII (no inventados):
--   nombre        Vvayra Meryem Sisik   (grafía sin eses turcas, decidida el 27-ago)
--   club          Santa Cruz International School (SCIS)
--   categoria_id  5 = Fomento Deportivo (su `cat_oficial` en la inscripción)
--   celular       70954747
--   email         keremsisik@gmail.com
--
-- ⚠️ SOBRE EL EMAIL — leer antes de crearle una cuenta:
-- `keremsisik@gmail.com` es casi con certeza el del PADRE: el titular del pago
-- de su inscripción es "Sisik Omer Kerem". Se guarda igual porque es el único
-- canal de contacto que dieron, y vaciarlo la mandaría al grupo de "faltan
-- datos" perdiendo lo único que hay (misma lógica que la regla del dato ajeno).
-- PERO el email es la CREDENCIAL DE LOGIN en Supabase Auth: si se le crea la
-- cuenta con este email, la hija entra con la casilla del padre. Ya hay tres
-- casos así en el padrón (Jhanna Schugair, Miguel Daher, Luciana Angulo) y
-- están anotados como problema a corregir. No repetir el patrón a ciegas:
-- confirmar el email propio antes del alta de cuenta.
--
-- Verificado antes de escribir: los dos triggers de `jinetes`
-- (`jinetes_restrict_cols_trigger` y `on-jinete-link`) son BEFORE/AFTER UPDATE,
-- así que un INSERT no dispara ninguno. Cero correos.
-- Idempotente: guard `not exists` por nombre.
-- ============================================================================

-- ─── PASO 1: preview ───────────────────────────────────────────────────────
select 'ANTES' as momento,
       (select count(*) from jinetes)                                as jinetes_total,
       (select count(*) from jinetes where nombre ilike '%vvayra%')  as ya_existe,
       (select count(*) from inscripciones
         where concurso_id='XIII-CDS-2026' and nombre_libre)         as nombres_a_mano;

-- ─── PASO 2: alta ──────────────────────────────────────────────────────────
insert into jinetes (nombre, club, categoria_id, celular, email, activo)
select 'Vvayra Meryem Sisik',
       'Santa Cruz International School (SCIS)',
       5,                      -- Fomento Deportivo
       '70954747',
       'keremsisik@gmail.com',
       true
 where not exists (select 1 from jinetes where nombre = 'Vvayra Meryem Sisik');

-- ─── PASO 3: la inscripción ya matchea el padrón ───────────────────────────
update inscripciones i
   set nombre_libre = false,
       nota_admin = coalesce(nota_admin || ' | ', '') ||
                    'Ficha creada en jinetes el 27-ago (SCIS, Fomento Deportivo). Competia en 2025 pero nunca habia entrado al padron, por eso el autocompletado no la encontraba. Email keremsisik@gmail.com es probablemente del padre (titular del pago: Sisik Omer Kerem): confirmar uno propio antes de crearle cuenta.'
 where i.concurso_id = 'XIII-CDS-2026'
   and i.nombre_libre
   and exists (select 1 from jinetes j where j.nombre = i.nombre);

-- ─── PASO 4: verificación ──────────────────────────────────────────────────
select 'DESPUES' as momento,
       (select count(*) from jinetes)                                          as jinetes_total,
       (select count(*) from inscripciones
         where concurso_id='XIII-CDS-2026' and nombre_libre)                   as nombres_a_mano,
       (select count(*) from inscripciones
         where concurso_id='XIII-CDS-2026' and equino_libre)                   as equinos_a_mano;

-- Toda inscripción del XIII debe matchear una ficha del padrón.
select 'SIN FICHA' as chequeo, i.nombre
  from inscripciones i
 where i.concurso_id = 'XIII-CDS-2026'
   and not exists (select 1 from jinetes j where j.nombre = i.nombre);

select 'FICHA NUEVA' as que, nombre, club, categoria_id, celular, activo
  from jinetes where nombre = 'Vvayra Meryem Sisik';
