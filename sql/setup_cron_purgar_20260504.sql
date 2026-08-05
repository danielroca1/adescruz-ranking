-- =====================================================================
-- Schedule mensual para purgar-comprobantes
-- Fecha: 2026-05-04
-- Cron: día 1 de cada mes, 07:00 UTC = 03:00 hora Bolivia (UTC-4)
-- =====================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purgar-comprobantes-mensual') THEN
    PERFORM cron.unschedule('purgar-comprobantes-mensual');
  END IF;
END $$;

SELECT cron.schedule(
  'purgar-comprobantes-mensual',
  '0 7 1 * *',  -- minuto=0 hora=7UTC día=1 mes=* dow=*
  $cron$
    SELECT net.http_post(
      url := 'https://djuelrvcjuqvwxvumvzd.supabase.co/functions/v1/purgar-comprobantes',
      headers := jsonb_build_object(
        'Authorization', 'Bearer sb_publishable_uDQKLMkdEKiAlA2ndhZ-vg_jmKZt_9v',
        'Content-Type',  'application/json'
      ),
      body := '{}'::jsonb
    );
  $cron$
);

-- Verificación
SELECT jobid, jobname, schedule, active
  FROM cron.job
 WHERE jobname IN ('cierre-inscripciones-tick', 'purgar-comprobantes-mensual')
 ORDER BY jobname;
