-- =====================================================================
-- Política de retención de comprobantes — schema
-- Fecha: 2026-05-04
-- Objetivo: agregar columna comprobante_purgado_en a inscripciones y
--           afiliaciones para marcar cuándo el archivo del bucket fue
--           borrado por la edge function purgar-comprobantes.
--           El registro queda; solo el archivo escaneado se borra.
--           validacion_ocr ya conserva banco/monto/fecha/nro_operacion
--           como audit trail.
-- =====================================================================

ALTER TABLE public.inscripciones
  ADD COLUMN IF NOT EXISTS comprobante_purgado_en timestamptz;

ALTER TABLE public.afiliaciones
  ADD COLUMN IF NOT EXISTS comprobante_purgado_en timestamptz;

COMMENT ON COLUMN public.inscripciones.comprobante_purgado_en IS
  'Cuando el archivo fue borrado del bucket por la edge function purgar-comprobantes. NULL = aún disponible.';
COMMENT ON COLUMN public.afiliaciones.comprobante_purgado_en IS
  'Cuando el archivo fue borrado del bucket por la edge function purgar-comprobantes. NULL = aún disponible.';

-- Índices para acelerar el query de la edge function (filtra estado terminal +
-- comprobante presente + no purgado + creado hace mucho)
CREATE INDEX IF NOT EXISTS inscripciones_purgar_idx
  ON public.inscripciones (created_at)
  WHERE comprobante_url IS NOT NULL AND comprobante_purgado_en IS NULL;

CREATE INDEX IF NOT EXISTS afiliaciones_purgar_idx
  ON public.afiliaciones (created_at)
  WHERE comprobante_url IS NOT NULL AND comprobante_purgado_en IS NULL;

-- Verificación
SELECT 'inscripciones' AS tabla, column_name, data_type
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='inscripciones' AND column_name='comprobante_purgado_en'
UNION ALL
SELECT 'afiliaciones' AS tabla, column_name, data_type
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='afiliaciones' AND column_name='comprobante_purgado_en';
