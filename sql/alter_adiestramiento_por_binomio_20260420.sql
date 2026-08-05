-- ═══════════════════════════════════════════════════════════════════════
-- Migrar tabla adiestramiento — de (jinete, categoria, temporada) a (jinete, caballo, categoria, temporada)
-- Fecha: 2026-04-20
-- Motivo: el adiestramiento es por BINOMIO (jinete+caballo), no por jinete.
-- Precondición: tabla vacía (confirmado por Daniel).
-- ═══════════════════════════════════════════════════════════════════════

-- Diagnóstico previo — listar el constraint unique actual (nombre variable según Postgres):
-- SELECT conname
-- FROM pg_constraint
-- WHERE conrelid = 'adiestramiento'::regclass
--   AND contype  = 'u';

BEGIN;

-- 1) Agregar columna caballo (nullable para el ALTER, luego se hace NOT NULL).
ALTER TABLE adiestramiento
  ADD COLUMN IF NOT EXISTS caballo TEXT;

-- 2) Eliminar constraint unique antiguo (nombre por defecto de Supabase).
--    Si el constraint tiene otro nombre, ajustar aquí.
ALTER TABLE adiestramiento
  DROP CONSTRAINT IF EXISTS adiestramiento_jinete_categoria_temporada_key;

-- 3) Crear nuevo constraint unique por binomio.
ALTER TABLE adiestramiento
  ADD CONSTRAINT adiestramiento_binomio_unique
  UNIQUE (jinete, caballo, categoria, temporada);

-- 4) Ahora que no hay filas, hacer caballo NOT NULL.
ALTER TABLE adiestramiento
  ALTER COLUMN caballo SET NOT NULL;

COMMIT;

-- Verificación:
-- \d adiestramiento
-- Debe mostrar: caballo text NOT NULL, y constraint adiestramiento_binomio_unique UNIQUE (jinete, caballo, categoria, temporada).
