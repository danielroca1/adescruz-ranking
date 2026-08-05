-- ============================================================
-- Tabla: eventos_externos
-- Calendario 2026 — eventos NO-CDS (CDA, FEI, Copa Bolivia,
-- Sudamericano, ODESSUR, Nacionales, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.eventos_externos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temporada     int NOT NULL DEFAULT 2026,
  slug          text NOT NULL,                    -- ID estable: 'cda1', 'fei1', 'copa', 'odessur'…
  tipo          text NOT NULL,                    -- 'CDA' | 'FEI' | 'COPA' | 'INTERNACIONAL' | 'NACIONAL'
  nombre        text NOT NULL,                    -- 'CDA 1 — Adiestramiento'
  numero_label  text,                             -- '1', '2', '' (lo que se muestra debajo del tipo)
  fecha_inicio  date NOT NULL,
  fecha_fin     date,                             -- null si es de un solo día
  sede          text,                             -- 'CHSC', 'Argentina', etc.
  nota          text,                             -- texto secundario (ej. "Coincide con XIV CDS")
  orden_mes     int,                              -- para ordenar dentro de un mes (opcional)
  estado        text NOT NULL DEFAULT 'programado', -- 'programado' | 'realizado' | 'cancelado'
  visible       boolean NOT NULL DEFAULT true,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (temporada, slug)
);

-- Índice para queries por temporada ordenadas por fecha
CREATE INDEX IF NOT EXISTS eventos_externos_temporada_fecha_idx
  ON public.eventos_externos (temporada, fecha_inicio);

-- Trigger para mantener actualizado_en
CREATE OR REPLACE FUNCTION public.touch_eventos_externos()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_eventos_externos ON public.eventos_externos;
CREATE TRIGGER trg_touch_eventos_externos
  BEFORE UPDATE ON public.eventos_externos
  FOR EACH ROW EXECUTE FUNCTION public.touch_eventos_externos();

-- ============================================================
-- RLS: lectura pública, escritura solo autenticados con rol admin
-- (ajustar policy según el patrón ya usado en `campeonatos`)
-- ============================================================
ALTER TABLE public.eventos_externos ENABLE ROW LEVEL SECURITY;

-- Lectura pública
DROP POLICY IF EXISTS "eventos_externos_select_public" ON public.eventos_externos;
CREATE POLICY "eventos_externos_select_public"
  ON public.eventos_externos
  FOR SELECT
  USING (true);

-- Escritura: solo authenticated (mismo patrón que campeonatos)
DROP POLICY IF EXISTS "eventos_externos_write_auth" ON public.eventos_externos;
CREATE POLICY "eventos_externos_write_auth"
  ON public.eventos_externos
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
