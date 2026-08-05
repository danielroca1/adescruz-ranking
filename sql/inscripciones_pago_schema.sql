-- ============================================================
-- Schema: validación de pagos en inscripciones
-- Sesión 2026-04-26
-- ============================================================
-- Cambios:
--   - Columnas para auditoría manual (Fase 1)
--   - Columnas para datos extraídos por OCR (Fase 2)
--   - UNIQUE constraint en nro_operacion (anti-reuso)
-- ============================================================

-- ── Datos del comprobante (extraídos por OCR o ingresados a mano) ──
ALTER TABLE public.inscripciones
  ADD COLUMN IF NOT EXISTS nro_operacion   text,
  ADD COLUMN IF NOT EXISTS monto_pagado    numeric(10,2),
  ADD COLUMN IF NOT EXISTS banco_origen    text,
  ADD COLUMN IF NOT EXISTS titular_origen  text,
  ADD COLUMN IF NOT EXISTS fecha_pago      timestamptz,
  ADD COLUMN IF NOT EXISTS glosa           text;

-- ── Cálculo nuestro y resultado de validación ─────────────────────
ALTER TABLE public.inscripciones
  ADD COLUMN IF NOT EXISTS monto_esperado  numeric(10,2),
  ADD COLUMN IF NOT EXISTS validacion_ocr  jsonb;  -- response completa de Claude Vision para auditar

-- ── Auditoría humana (Fase 1) ─────────────────────────────────────
ALTER TABLE public.inscripciones
  ADD COLUMN IF NOT EXISTS revisado_por    uuid REFERENCES public.perfiles(id),
  ADD COLUMN IF NOT EXISTS revisado_en     timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rechazo  text;

-- ── Anti-reuso: el mismo número de operación bancaria no puede
--    aparecer 2 veces. Permitimos NULL múltiples (inscripciones
--    viejas sin nro extraído todavía).
CREATE UNIQUE INDEX IF NOT EXISTS inscripciones_nro_operacion_key
  ON public.inscripciones (nro_operacion)
  WHERE nro_operacion IS NOT NULL;

-- ── Filtros para queries del admin ────────────────────────────────
CREATE INDEX IF NOT EXISTS inscripciones_estado_concurso_idx
  ON public.inscripciones (concurso_id, estado, created_at DESC);

-- ── Estado: ampliar lista de valores aceptados ────────────────────
-- Hoy `estado` es text libre (no enum). Documentamos los valores
-- esperados sin agregar CHECK constraint para no romper inscripciones
-- viejas. Valores válidos:
--   'pendiente'        — recién entró, sin verificar
--   'revision_manual'  — OCR falló o algo ambiguo, requiere humano
--   'aprobada'         — pago verificado
--   'rechazada'        — pago inválido (motivo en motivo_rechazo)

-- ── Verificación ──────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'inscripciones'
ORDER BY ordinal_position;
