-- =====================================================================
-- Fase A · Paso 1 — Crear tabla tarifas_afiliacion
-- Fecha: 2026-04-29
-- Objetivo: tabla 1-row-por-temporada con costos editables de afiliación.
--           Espejo de tarifas_inscripcion. RLS: lectura pública, escritura admin.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.tarifas_afiliacion (
  temporada        integer PRIMARY KEY,
  costo_jinete     numeric(10,2) NOT NULL DEFAULT 500,
  costo_caballo    numeric(10,2) NOT NULL DEFAULT 210,
  notas_publicas   text,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid REFERENCES public.perfiles(id)
);

COMMENT ON TABLE  public.tarifas_afiliacion IS
  'Tarifas de afiliación anual por temporada. Editables desde admin.';
COMMENT ON COLUMN public.tarifas_afiliacion.costo_jinete IS
  'Bs. por jinete. Cobrado solo si tiene al menos un caballo en categoría no-FC.';
COMMENT ON COLUMN public.tarifas_afiliacion.costo_caballo IS
  'Bs. por caballo en categoría no-FC. Caballos FC siempre gratis. Caballo ya afiliado por otro jinete: 0 con nota.';

-- Backfill 2026 con valores oficiales confirmados por Daniel
INSERT INTO public.tarifas_afiliacion (temporada, costo_jinete, costo_caballo)
VALUES (2026, 500, 210)
ON CONFLICT (temporada) DO NOTHING;

-- RLS
ALTER TABLE public.tarifas_afiliacion ENABLE ROW LEVEL SECURITY;

-- Lectura pública (igual que tarifas_inscripcion)
DROP POLICY IF EXISTS "tarifas_afiliacion lectura publica" ON public.tarifas_afiliacion;
CREATE POLICY "tarifas_afiliacion lectura publica"
  ON public.tarifas_afiliacion
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Escritura solo admin/super_admin
DROP POLICY IF EXISTS "tarifas_afiliacion escritura admin" ON public.tarifas_afiliacion;
CREATE POLICY "tarifas_afiliacion escritura admin"
  ON public.tarifas_afiliacion
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('admin','super_admin')
        AND p.activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('admin','super_admin')
        AND p.activo = true
    )
  );

-- Verificación post-ejecución
SELECT * FROM public.tarifas_afiliacion;
