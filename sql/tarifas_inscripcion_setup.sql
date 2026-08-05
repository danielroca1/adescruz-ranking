-- ============================================================
-- Tabla: tarifas_inscripcion
-- Una row por temporada. Las 4 tarifas que ve el público + el
-- descuento por un solo día. La lógica de cálculo (en JS y TS)
-- las lee de acá, no las hardcodea.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tarifas_inscripcion (
  temporada            int PRIMARY KEY,
  fc_ambos             numeric(10,2) NOT NULL,   -- Futuros Campeones, los 2 días
  general_ambos        numeric(10,2) NOT NULL,   -- Demás categorías, los 2 días
  segunda_pasada_dia   numeric(10,2) NOT NULL,   -- Bs por pasada por día (no se prorratea)
  ultimo_momento       numeric(10,2) NOT NULL,   -- Por binomio, ambos días
  descuento_un_dia     numeric(4,3)  NOT NULL DEFAULT 0.5,  -- Factor para 1 día (0.5 = mitad)
  notas_publicas       text,                     -- Texto opcional al pie de la tabla pública
  actualizado_en       timestamptz NOT NULL DEFAULT now()
);

-- Trigger de actualizado_en
CREATE OR REPLACE FUNCTION public.touch_tarifas_inscripcion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.actualizado_en = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_tarifas ON public.tarifas_inscripcion;
CREATE TRIGGER trg_touch_tarifas
  BEFORE UPDATE ON public.tarifas_inscripcion
  FOR EACH ROW EXECUTE FUNCTION public.touch_tarifas_inscripcion();

-- RLS
ALTER TABLE public.tarifas_inscripcion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tarifas_select_public" ON public.tarifas_inscripcion;
CREATE POLICY "tarifas_select_public"
  ON public.tarifas_inscripcion FOR SELECT USING (true);

DROP POLICY IF EXISTS "tarifas_admin_write" ON public.tarifas_inscripcion;
CREATE POLICY "tarifas_admin_write"
  ON public.tarifas_inscripcion FOR ALL
  TO authenticated
  USING (get_my_rol() = ANY (ARRAY['superadmin'::text, 'admin'::text]))
  WITH CHECK (get_my_rol() = ANY (ARRAY['superadmin'::text, 'admin'::text]));

-- Backfill 2026 con valores de MEMORY 2026-04-22
INSERT INTO public.tarifas_inscripcion
  (temporada, fc_ambos, general_ambos, segunda_pasada_dia, ultimo_momento, descuento_un_dia, notas_publicas)
VALUES
  (2026, 200, 250, 50, 500, 0.5,
   'Las segundas pasadas siguen costando Bs 50 por pasada incluso en días sueltos.')
ON CONFLICT (temporada) DO NOTHING;

-- Verificación
SELECT * FROM public.tarifas_inscripcion WHERE temporada = 2026;
