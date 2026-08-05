-- =====================================================================
-- Fase A · Paso 3 — Columnas OCR + auditoría en afiliaciones
-- Fecha: 2026-04-29
-- Objetivo: espejo de inscripciones para validación automática de comprobantes.
--           Anti-reuso vía UNIQUE INDEX en nro_operacion.
-- =====================================================================

-- Datos extraídos por OCR (o ingresados manualmente por admin)
ALTER TABLE public.afiliaciones
  ADD COLUMN IF NOT EXISTS nro_operacion   text,
  ADD COLUMN IF NOT EXISTS monto_pagado    numeric(10,2),
  ADD COLUMN IF NOT EXISTS monto_esperado  numeric(10,2),
  ADD COLUMN IF NOT EXISTS banco_origen    text,
  ADD COLUMN IF NOT EXISTS titular_origen  text,
  ADD COLUMN IF NOT EXISTS fecha_pago      timestamptz,
  ADD COLUMN IF NOT EXISTS glosa           text;

-- Resultado completo de Claude Vision (jsonb para auditoría/debug)
ALTER TABLE public.afiliaciones
  ADD COLUMN IF NOT EXISTS validacion_ocr  jsonb;

-- Auditoría humana
ALTER TABLE public.afiliaciones
  ADD COLUMN IF NOT EXISTS revisado_por    uuid REFERENCES public.perfiles(id),
  ADD COLUMN IF NOT EXISTS revisado_en     timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rechazo  text;

-- Hacer NULLABLE las columnas viejas que migran a afiliacion_caballos
-- (idempotente: si ya son nullable, DROP NOT NULL es no-op)
ALTER TABLE public.afiliaciones ALTER COLUMN nombre_caballo DROP NOT NULL;
ALTER TABLE public.afiliaciones ALTER COLUMN categoria_id   DROP NOT NULL;

-- =====================================================================
-- Índice UNIQUE para anti-reuso de nro_operacion DENTRO de afiliaciones
-- (el cross-table check con inscripciones se hace en la Edge Function)
-- =====================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_afiliaciones_nro_operacion_unique
  ON public.afiliaciones(nro_operacion)
  WHERE nro_operacion IS NOT NULL;

-- =====================================================================
-- site_config: glosa esperada para afiliación (editable desde admin)
-- =====================================================================
INSERT INTO public.site_config (key, value)
VALUES ('afiliacion_glosa_esperada', 'Afiliacion ADESCRUZ 2026')
ON CONFLICT (key) DO NOTHING;

-- =====================================================================
-- Comentarios
-- =====================================================================
COMMENT ON COLUMN public.afiliaciones.nro_operacion IS
  'N° de operación bancaria extraído del comprobante. UNIQUE: anti-reuso intra-afiliaciones.';
COMMENT ON COLUMN public.afiliaciones.monto_esperado IS
  'Bs calculados por el sistema = costo_jinete (si aplica) + sum(costo_aplicado de afiliacion_caballos).';
COMMENT ON COLUMN public.afiliaciones.validacion_ocr IS
  'Response completa de Claude Vision (banco, titular, monto, fecha, nro_op, cuenta destino, confianza, notas).';
COMMENT ON COLUMN public.afiliaciones.motivo_rechazo IS
  'Si estado=rechazada o revision_manual: lista de razones (cuenta destino mismatch, monto bajo, etc.).';

-- =====================================================================
-- Verificación post-ejecución
-- =====================================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'afiliaciones'
ORDER BY ordinal_position;

-- Confirmar glosa esperada
SELECT key, value FROM public.site_config WHERE key = 'afiliacion_glosa_esperada';

-- Confirmar índice UNIQUE
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'afiliaciones'
  AND indexname = 'idx_afiliaciones_nro_operacion_unique';
