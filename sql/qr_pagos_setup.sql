-- ============================================================
-- Setup: QR de pago por CDS
-- Sesión 2026-04-26
-- ============================================================
--   - Columna `qr_inscripcion_url` en campeonatos
--   - Bucket público `qr-pagos`
--   - RLS: lectura pública, escritura solo authenticated admins
-- ============================================================

-- 1. Columna en campeonatos
ALTER TABLE public.campeonatos
  ADD COLUMN IF NOT EXISTS qr_inscripcion_url text;

-- 2. Bucket público
INSERT INTO storage.buckets (id, name, public)
VALUES ('qr-pagos', 'qr-pagos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Policies storage.objects para el bucket qr-pagos
--    NO creamos SELECT (bucket public=true → CDN sirve URLs directas).
--    INSERT/UPDATE/DELETE solo para admins authenticated.

DROP POLICY IF EXISTS "Admins upload qr-pagos" ON storage.objects;
CREATE POLICY "Admins upload qr-pagos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'qr-pagos'
    AND get_my_rol() = ANY (ARRAY['superadmin'::text, 'admin'::text])
  );

DROP POLICY IF EXISTS "Admins update qr-pagos" ON storage.objects;
CREATE POLICY "Admins update qr-pagos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'qr-pagos'
    AND get_my_rol() = ANY (ARRAY['superadmin'::text, 'admin'::text])
  );

DROP POLICY IF EXISTS "Admins delete qr-pagos" ON storage.objects;
CREATE POLICY "Admins delete qr-pagos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'qr-pagos'
    AND get_my_rol() = ANY (ARRAY['superadmin'::text, 'admin'::text])
  );

-- Verificación
SELECT id, name, public FROM storage.buckets WHERE id = 'qr-pagos';
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'campeonatos' AND column_name = 'qr_inscripcion_url';
