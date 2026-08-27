-- ============================================================================
-- FIX_CABALLOS_NOMBRE_LIBRE_2026-08-27.sql
--
-- Resuelve los dos caballos que los jinetes escribieron A MANO en el
-- formulario del XIII CDS (flag `equino_libre = true`, la ✋ del admin).
--
-- Los dos ESTABAN en el padrón, con una letra distinta. No fue similitud de
-- nombre: coinciden jinete, club (SCIS los dos) y categoría con el historial
-- de `resultados_pdf`. Son el mismo caballo, sin duda.
--
--   Escrito a mano            Padrón                    Decisión de Daniel
--   ------------------------  ------------------------  ----------------------
--   Dolce Chanel di Rozel     Dolce Chanel Du Rozel     gana el PADRÓN
--   Ydalina Rex               Idalina Rex               gana la JINETE
--
-- Por eso los dos casos se arreglan al revés uno del otro.
--
-- Verificado antes de escribir: ni `caballos` ni `resultados_pdf` tienen
-- triggers; el único trigger de UPDATE de `inscripciones` está scopeado a la
-- columna `estado`, que este script no toca. Cero correos.
--
-- Idempotente: la segunda corrida no encuentra filas que cambiar.
-- ============================================================================

-- ─── PASO 1: preview ───────────────────────────────────────────────────────
select 'caballos' as tabla, nombre as valor, count(*) as n from caballos
 where nombre in ('Idalina Rex','Ydalina Rex','Dolce Chanel Du Rozel','Dolce Chanel di Rozel') group by nombre
union all select 'resultados_pdf', caballo, count(*) from resultados_pdf
 where caballo in ('Idalina Rex','Ydalina Rex','Dolce Chanel Du Rozel','Dolce Chanel di Rozel') group by caballo
union all select 'afiliacion_caballos', nombre_caballo, count(*) from afiliacion_caballos
 where nombre_caballo in ('Idalina Rex','Ydalina Rex') group by nombre_caballo
union all select 'inscripciones', equino, count(*) from inscripciones
 where equino in ('Idalina Rex','Ydalina Rex','Dolce Chanel Du Rozel','Dolce Chanel di Rozel') group by equino;

-- ─── CASO 1: Dolce Chanel — gana el padrón ─────────────────────────────────
-- El padrón y el historial ya dicen "Du Rozel". Solo se corrige la inscripción
-- de Victoria Argandoña, que escribió "di". No se toca nada más.
update inscripciones
   set equino = 'Dolce Chanel Du Rozel',
       equino_libre = false
 where equino = 'Dolce Chanel di Rozel';

-- ─── CASO 2: Ydalina Rex — gana la jinete, el padrón tenía el typo ─────────
-- Micaela Navia escribió "Ydalina" y esa es la grafía correcta. Hay que
-- corregir el padrón Y el historial a la vez: si se cambia solo `caballos`,
-- las 3 filas de `resultados_pdf` quedan huérfanas de ficha.
-- El guard NOT EXISTS evita crear un duplicado si ya existiera la grafía nueva.
update caballos
   set nombre = 'Ydalina Rex'
 where nombre = 'Idalina Rex'
   and not exists (select 1 from caballos c2 where c2.nombre = 'Ydalina Rex');

update resultados_pdf
   set caballo = 'Ydalina Rex'
 where caballo = 'Idalina Rex';

update afiliacion_caballos
   set nombre_caballo = 'Ydalina Rex'
 where nombre_caballo = 'Idalina Rex';

-- La inscripción ya dice "Ydalina Rex": solo hay que sacarle el flag de
-- escrito-a-mano, porque ahora sí coincide con el padrón.
update inscripciones
   set equino_libre = false
 where equino = 'Ydalina Rex' and equino_libre;

-- ─── PASO 3: verificación ──────────────────────────────────────────────────
select 'DESPUES' as momento,
       (select count(*) from caballos           where nombre = 'Idalina Rex')         as caballos_viejo,
       (select count(*) from caballos           where nombre = 'Ydalina Rex')         as caballos_nuevo,
       (select count(*) from resultados_pdf     where caballo = 'Idalina Rex')        as resultados_viejo,
       (select count(*) from resultados_pdf     where caballo = 'Ydalina Rex')        as resultados_nuevo,
       (select count(*) from afiliacion_caballos where nombre_caballo = 'Ydalina Rex') as afiliacion_nuevo,
       (select count(*) from inscripciones      where equino_libre)                   as siguen_a_mano;

-- Cruce final: ninguna fila de resultados debe quedar sin ficha en `caballos`.
select 'HUERFANOS' as chequeo, count(*) as filas
  from resultados_pdf r
 where r.caballo in ('Ydalina Rex','Dolce Chanel Du Rozel')
   and not exists (select 1 from caballos c where c.nombre = r.caballo);
