CREATE TABLE public.afiliaciones_equinos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  afiliacion_id uuid NOT NULL REFERENCES public.afiliaciones(id) ON DELETE CASCADE,
  nombre_caballo text NOT NULL,
  categoria_id integer REFERENCES public.categorias(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT afiliaciones_equinos_pkey PRIMARY KEY (id)
);

-- Index for lookups by afiliacion
CREATE INDEX idx_afiliaciones_equinos_afiliacion_id ON public.afiliaciones_equinos(afiliacion_id);

-- RLS
ALTER TABLE public.afiliaciones_equinos ENABLE ROW LEVEL SECURITY;

-- Allow public insert (same as afiliaciones)
CREATE POLICY "Allow public insert" ON public.afiliaciones_equinos
  FOR INSERT TO anon WITH CHECK (true);

-- Allow authenticated read
CREATE POLICY "Allow authenticated read" ON public.afiliaciones_equinos
  FOR SELECT TO authenticated USING (true);

-- Insert or update site_config defaults
INSERT INTO site_config (key, value, updated_at)
VALUES
  ('afiliacion_precio', '490', now()),
  ('afiliacion_equino_precio', '210', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
