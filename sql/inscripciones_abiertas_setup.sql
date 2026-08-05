-- ============================================================
-- Inscripciones abiertas/cerradas POR CDS (no global)
-- ============================================================

ALTER TABLE public.campeonatos
  ADD COLUMN IF NOT EXISTS inscripciones_abiertas boolean NOT NULL DEFAULT false;

-- Default seguro: cerradas. El admin las abre desde el panel.
-- Inicialmente abrimos solo el V CDS (próximo realista al 2026-04-26).
-- Daniel puede cerrarlo y abrir otro desde admin después.
UPDATE public.campeonatos
   SET inscripciones_abiertas = true
 WHERE temporada = 2026 AND numero = 5;

-- Verificación
SELECT numero, nombre, sede, fecha_sab, fecha_dom, estado, inscripciones_abiertas
FROM public.campeonatos
WHERE temporada = 2026
ORDER BY numero;
