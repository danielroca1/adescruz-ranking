-- =====================================================================
-- Habilitar pg_cron + schedule para auto-cierre de inscripciones
-- Fecha: 2026-05-03
-- Objetivo: invocar la edge function `cierre-inscripciones` cada 5
--           minutos. La function es idempotente (gate por
--           cierre_ejecutado_en) — segura de correr aunque no haya
--           nada pendiente.
-- =====================================================================

-- Extensiones requeridas. pg_net ya viene habilitado en Supabase pero
-- lo declaro defensivo. pg_cron lo habilitamos por primera vez.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Si ya existía un schedule con este nombre lo borro antes (idempotencia)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cierre-inscripciones-tick') THEN
    PERFORM cron.unschedule('cierre-inscripciones-tick');
  END IF;
END $$;

-- Schedule cada 5 minutos
SELECT cron.schedule(
  'cierre-inscripciones-tick',
  '*/5 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://djuelrvcjuqvwxvumvzd.supabase.co/functions/v1/cierre-inscripciones',
      headers := jsonb_build_object(
        'Authorization', 'Bearer sb_publishable_uDQKLMkdEKiAlA2ndhZ-vg_jmKZt_9v',
        'Content-Type',  'application/json'
      ),
      body := '{}'::jsonb
    );
  $cron$
);

-- Verificación
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'cierre-inscripciones-tick';
