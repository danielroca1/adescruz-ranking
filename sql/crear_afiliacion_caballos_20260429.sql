-- =====================================================================
-- Fase A · Paso 2 — Crear tabla afiliacion_caballos (multi-caballo)
-- Fecha: 2026-04-29
-- Objetivo: tabla hija de afiliaciones. Una fila por caballo afiliado.
--           Permite cobro independiente por caballo + tracking de compartidos.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.afiliacion_caballos (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliacion_id             uuid NOT NULL REFERENCES public.afiliaciones(id) ON DELETE CASCADE,
  nombre_caballo            text NOT NULL,
  categoria_id              integer NOT NULL REFERENCES public.categorias(id),
  costo_aplicado            numeric(10,2) NOT NULL DEFAULT 0,
  afiliacion_compartida_id  uuid REFERENCES public.afiliaciones(id),
  created_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.afiliacion_caballos IS
  'Caballos afiliados bajo una afiliación de jinete. Múltiples por afiliación.';
COMMENT ON COLUMN public.afiliacion_caballos.costo_aplicado IS
  'Snapshot Bs cobrado por este caballo en el momento de afiliarse (0 si FC, 0 si compartido aprobado, costo_caballo si normal).';
COMMENT ON COLUMN public.afiliacion_caballos.afiliacion_compartida_id IS
  'Si este caballo ya estaba afiliado por otro jinete (compartido), apunta a esa afiliación. NULL si es el primer afiliador.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_afiliacion_caballos_afiliacion
  ON public.afiliacion_caballos(afiliacion_id);

CREATE INDEX IF NOT EXISTS idx_afiliacion_caballos_nombre_lower
  ON public.afiliacion_caballos(lower(nombre_caballo));

-- Un caballo no puede aparecer dos veces en la misma afiliación
CREATE UNIQUE INDEX IF NOT EXISTS idx_afiliacion_caballos_unique
  ON public.afiliacion_caballos(afiliacion_id, lower(nombre_caballo));

-- RLS
ALTER TABLE public.afiliacion_caballos ENABLE ROW LEVEL SECURITY;

-- Lectura: el dueño de la afiliación + admins
DROP POLICY IF EXISTS "afiliacion_caballos lectura" ON public.afiliacion_caballos;
CREATE POLICY "afiliacion_caballos lectura"
  ON public.afiliacion_caballos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.afiliaciones a
      WHERE a.id = afiliacion_caballos.afiliacion_id
        AND (
          a.email = (SELECT email FROM public.perfiles WHERE id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.perfiles p
            WHERE p.id = auth.uid()
              AND p.rol IN ('admin','super_admin')
              AND p.activo = true
          )
        )
    )
  );

-- Insert público (anon) — el form de registro lo usa antes de auth
DROP POLICY IF EXISTS "afiliacion_caballos insert publico" ON public.afiliacion_caballos;
CREATE POLICY "afiliacion_caballos insert publico"
  ON public.afiliacion_caballos
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Update/Delete solo admin
DROP POLICY IF EXISTS "afiliacion_caballos modificar admin" ON public.afiliacion_caballos;
CREATE POLICY "afiliacion_caballos modificar admin"
  ON public.afiliacion_caballos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('admin','super_admin')
        AND p.activo = true
    )
  );

DROP POLICY IF EXISTS "afiliacion_caballos borrar admin" ON public.afiliacion_caballos;
CREATE POLICY "afiliacion_caballos borrar admin"
  ON public.afiliacion_caballos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('admin','super_admin')
        AND p.activo = true
    )
  );

-- =====================================================================
-- Migración: copiar afiliaciones.nombre_caballo existentes a la tabla nueva
-- (No tocamos la columna vieja todavía — eso es paso 3 después de Fase B)
-- =====================================================================

INSERT INTO public.afiliacion_caballos (afiliacion_id, nombre_caballo, categoria_id, costo_aplicado)
SELECT
  a.id,
  a.nombre_caballo,
  a.categoria_id,
  0  -- desconocido para registros viejos; queda en 0 hasta que se reprocese
FROM public.afiliaciones a
WHERE a.nombre_caballo IS NOT NULL
  AND a.nombre_caballo <> ''
  AND a.categoria_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.afiliacion_caballos ac
    WHERE ac.afiliacion_id = a.id
      AND lower(ac.nombre_caballo) = lower(a.nombre_caballo)
  );

-- =====================================================================
-- Verificación post-ejecución
-- =====================================================================

-- Conteo de afiliaciones con/sin caballo migrado
SELECT
  (SELECT count(*) FROM public.afiliaciones)                           AS total_afiliaciones,
  (SELECT count(*) FROM public.afiliaciones WHERE nombre_caballo IS NOT NULL AND nombre_caballo <> '')
                                                                        AS afiliaciones_con_caballo_viejo,
  (SELECT count(*) FROM public.afiliacion_caballos)                    AS filas_en_afiliacion_caballos;

-- Sample de las primeras 5 filas migradas
SELECT
  ac.id,
  ac.afiliacion_id,
  ac.nombre_caballo,
  c.nombre AS categoria,
  ac.costo_aplicado,
  ac.created_at
FROM public.afiliacion_caballos ac
LEFT JOIN public.categorias c ON c.id = ac.categoria_id
ORDER BY ac.created_at DESC
LIMIT 5;
