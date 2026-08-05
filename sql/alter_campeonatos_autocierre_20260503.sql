-- =====================================================================
-- Auto-cierre de inscripciones per-CDS — schema + backfill
-- Fecha: 2026-05-03
-- Objetivo: migrar el auto-cierre de site_config (global) a campeonatos
--           (per-CDS). Cada concurso tiene su propia fecha/hora de
--           cierre, su propio toggle activo, y su propia lista de
--           emails para enviar el Excel del orden de ingreso.
--
--           Mensaje (banner cuando cierra) sigue global en site_config
--           porque es el mismo para todos los CDS por reglamento.
-- =====================================================================

-- ─── 1) Helper: calcular viernes anterior al primer día del CDS, 15:00
--     hora Bolivia. Si el primer día es sábado (lo común), devuelve el
--     viernes inmediatamente anterior. Si fecha_sab es NULL usa fecha_dom.
CREATE OR REPLACE FUNCTION public.calcular_cierre_default(fecha_sab date, fecha_dom date)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  primer_dia date;
  dow int;
  dias_atras int;
  viernes_date date;
BEGIN
  primer_dia := COALESCE(fecha_sab, fecha_dom);
  IF primer_dia IS NULL THEN RETURN NULL; END IF;

  dow := EXTRACT(DOW FROM primer_dia)::int;  -- 0=dom, 1=lun, ..., 5=vie, 6=sab
  dias_atras := CASE dow
    WHEN 5 THEN 7  -- ya es viernes → viernes anterior (improbable)
    WHEN 6 THEN 1  -- sábado → -1 día (caso típico)
    WHEN 0 THEN 2  -- domingo → -2
    WHEN 1 THEN 3  -- lunes → -3
    WHEN 2 THEN 4  -- martes → -4
    WHEN 3 THEN 5  -- miércoles → -5
    WHEN 4 THEN 6  -- jueves → -6
  END;
  viernes_date := primer_dia - dias_atras;

  -- 15:00 zona Bolivia (UTC-4 sin DST) → 19:00 UTC
  RETURN (viernes_date + TIME '15:00:00') AT TIME ZONE 'America/La_Paz';
END;
$$;

COMMENT ON FUNCTION public.calcular_cierre_default IS
  'Devuelve viernes anterior al primer día del CDS a las 15:00 Bolivia. Usado para popular cierre_fecha por default en campeonatos.';

-- ─── 2) Columnas nuevas en campeonatos
ALTER TABLE public.campeonatos
  ADD COLUMN IF NOT EXISTS cierre_fecha        timestamptz,
  ADD COLUMN IF NOT EXISTS cierre_activo       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cierre_emails       text,
  ADD COLUMN IF NOT EXISTS cierre_ejecutado_en timestamptz;

COMMENT ON COLUMN public.campeonatos.cierre_fecha IS
  'Fecha/hora del cierre automático de inscripciones. Default = viernes anterior al primer día del CDS, 15:00 Bolivia. Editable per-CDS.';
COMMENT ON COLUMN public.campeonatos.cierre_activo IS
  'Si true, el cron auto-cierra las inscripciones cuando llegue cierre_fecha. Default true.';
COMMENT ON COLUMN public.campeonatos.cierre_emails IS
  'CSV de emails que reciben el Excel del orden de ingreso al cerrar. Per-CDS porque los jueces varían entre concursos.';
COMMENT ON COLUMN public.campeonatos.cierre_ejecutado_en IS
  'NULL = pendiente. Se setea al ejecutarse el auto-cierre. Reemplaza el mecanismo single-shot global anterior.';

-- Índice para acelerar el filtro de la edge function
CREATE INDEX IF NOT EXISTS campeonatos_cierre_pendiente_idx
  ON public.campeonatos (cierre_fecha)
  WHERE cierre_activo = true AND cierre_ejecutado_en IS NULL;

-- ─── 3) Backfill: calcular cierre_fecha default para todos los CDS
--     que aún no la tengan
UPDATE public.campeonatos
SET cierre_fecha = public.calcular_cierre_default(fecha_sab, fecha_dom)
WHERE cierre_fecha IS NULL
  AND COALESCE(fecha_sab, fecha_dom) IS NOT NULL;

-- ─── 4) Marcar CDS pasados como ya ejecutados, para que el cron no
--     los reprocese cuando se habilite. Conservadora: cualquier CDS
--     cuyo cierre_fecha ya pasó queda marcado.
UPDATE public.campeonatos
SET cierre_ejecutado_en = COALESCE(cierre_fecha, now())
WHERE cierre_fecha IS NOT NULL
  AND cierre_fecha < now()
  AND cierre_ejecutado_en IS NULL;

-- =====================================================================
-- Verificación post-ejecución
-- =====================================================================
SELECT
  numero,
  nombre,
  fecha_sab,
  fecha_dom,
  cierre_fecha AT TIME ZONE 'America/La_Paz' AS cierre_local,
  cierre_activo,
  cierre_ejecutado_en IS NOT NULL AS ya_cerrado,
  inscripciones_abiertas
FROM public.campeonatos
ORDER BY temporada, numero;
