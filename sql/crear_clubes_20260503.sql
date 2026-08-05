-- =====================================================================
-- Crear tabla clubes
-- Fecha: 2026-05-03
-- Objetivo: catálogo único de clubes/haras/escuelas usado por todos los
--           formularios (registro afiliación, inscripción CDS, auto-registro
--           jinete). Soft-delete via flag `activo` para no dejar huérfanos
--           jinetes ni eventos pasados con club inactivo.
--           Orden en dropdowns: alfabético por nombre.
--           RLS: lectura pública, escritura solo admin/super_admin.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.clubes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL UNIQUE,
  activo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid        REFERENCES public.perfiles(id)
);

COMMENT ON TABLE  public.clubes IS
  'Catálogo único de clubes/haras/escuelas. Fuente de verdad para dropdowns.';
COMMENT ON COLUMN public.clubes.activo IS
  'Soft-delete. Si false, no aparece en dropdowns nuevos pero los jinetes/eventos históricos conservan el nombre.';

-- Índice para acelerar dropdowns (filtra activo + ordena por nombre)
CREATE INDEX IF NOT EXISTS clubes_activo_nombre_idx
  ON public.clubes (activo, nombre);

-- Seed con los 11 clubes hardcodeados actualmente en
-- registro.html, inscripcion_cds.html, login.html
INSERT INTO public.clubes (nombre) VALUES
  ('Centro Ecuestre Amandari'),
  ('Club Hípico La Candela'),
  ('Club Hípico La Quinta'),
  ('Club Hípico Santa Cruz'),
  ('Club Hípico Saltos del Urubó'),
  ('Club Hípico Urubó'),
  ('Establecimiento Ecuestre Trejo'),
  ('Haras Alhambra'),
  ('Haras Cimarrones'),
  ('Haras Shugafaras'),
  ('Santa Cruz International School (SCIS)')
ON CONFLICT (nombre) DO NOTHING;

-- =====================================================================
-- RLS
-- =====================================================================
ALTER TABLE public.clubes ENABLE ROW LEVEL SECURITY;

-- Lectura pública (anon + authenticated) — los formularios públicos
-- (registro, inscripcion_cds, login) son anon hasta que el jinete se loguea.
DROP POLICY IF EXISTS "clubes lectura publica" ON public.clubes;
CREATE POLICY "clubes lectura publica"
  ON public.clubes
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Escritura solo admin/super_admin.
-- NOTA: incluyo 'superadmin' (sin underscore) además de 'super_admin' para
-- cubrir inconsistencia histórica de naming entre cms_setup.sql y los
-- migrations posteriores. Si confirmás que solo se usa una variante,
-- limpiamos esto en una migración futura.
DROP POLICY IF EXISTS "clubes escritura admin" ON public.clubes;
CREATE POLICY "clubes escritura admin"
  ON public.clubes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('admin','super_admin','superadmin')
        AND p.activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('admin','super_admin','superadmin')
        AND p.activo = true
    )
  );

-- =====================================================================
-- Verificación post-ejecución
-- =====================================================================
SELECT id, nombre, activo, created_at
  FROM public.clubes
  ORDER BY nombre;
