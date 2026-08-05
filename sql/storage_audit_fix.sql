-- ============================================================
-- AUDITORÍA DE POLICIES storage.objects — FIX
-- Sesión 2026-04-26
-- ============================================================
-- Cambios:
--   🟥 1 hole cerrado: Anon upload noticias fotos
--   🟨 4 limpiezas: rol {public} → {authenticated} en policies con
--      chequeo interno de admin (no cambian el comportamiento real).
-- ============================================================

-- ── 🟥 HOLE: Anon upload noticias fotos ────────────────────
-- Permitía que CUALQUIERA (sin login) subiera archivos al bucket
-- noticias-fotos. Mismo patrón que la "Anon delete noticias fotos"
-- que se dropeó el 2026-04-23. Las noticias son contenido admin-only.
DROP POLICY IF EXISTS "Anon upload noticias fotos" ON storage.objects;

CREATE POLICY "Admins upload noticias fotos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'noticias-fotos'
    AND get_my_rol() = ANY (ARRAY['superadmin'::text, 'admin'::text])
  );


-- ── 🟨 LIMPIEZA 1: Admins delete jinetes fotos ──────────────
-- Funcionalmente correcta (chequea auth.uid + rol), pero el rol
-- {public} hace que el motor evalúe la policy también para anónimos.
DROP POLICY IF EXISTS "Admins delete jinetes fotos" ON storage.objects;

CREATE POLICY "Admins delete jinetes fotos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'jinetes-fotos'
    AND get_my_rol() = ANY (ARRAY['superadmin'::text, 'admin'::text])
  );


-- ── 🟨 LIMPIEZA 2: Admins upload jinetes fotos ──────────────
DROP POLICY IF EXISTS "Admins upload jinetes fotos" ON storage.objects;

CREATE POLICY "Admins upload jinetes fotos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'jinetes-fotos'
    AND get_my_rol() = ANY (ARRAY['superadmin'::text, 'admin'::text])
  );


-- ── 🟨 LIMPIEZA 3: Admins update jinetes fotos ──────────────
DROP POLICY IF EXISTS "Admins update jinetes fotos" ON storage.objects;

CREATE POLICY "Admins update jinetes fotos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'jinetes-fotos'
    AND get_my_rol() = ANY (ARRAY['superadmin'::text, 'admin'::text])
  );


-- ── 🟨 LIMPIEZA 4: admins ven comprobantes ──────────────────
DROP POLICY IF EXISTS "admins ven comprobantes" ON storage.objects;

CREATE POLICY "admins ven comprobantes"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'comprobantes'
    AND get_my_rol() = ANY (ARRAY['superadmin'::text, 'admin'::text])
  );


-- ============================================================
-- Verificación post-fix: re-correr la query Q1 de storage_audit.sql
-- y confirmar que ya no aparece ninguna policy con rol {public}
-- y cmd ∈ (UPDATE, DELETE, ALL, INSERT con bucket_id-only check).
-- Las únicas que deben quedar con {public}:
--   - public puede subir comprobantes  (INSERT — intencional, formularios anónimos)
-- ============================================================
