-- ════════════════════════════════════════════════════════
-- 004 — Cerrar el acceso anónimo de escritura a NOTICIAS
-- ════════════════════════════════════════════════════════
--
-- PROBLEMA
-- El setup original (sql/setup/noticias_setup.sql) creó estas políticas:
--
--   CREATE POLICY "Anon full access noticias" ON noticias
--     FOR ALL USING (true) WITH CHECK (true);          -- ← escritura para anon
--   CREATE POLICY "Anon upload noticias fotos"  ...     -- ← subida para anon
--   CREATE POLICY "Anon delete noticias fotos"  ...     -- ← borrado para anon
--
-- El comentario decía "compatible con admin sin auth real". Hoy el admin SÍ
-- tiene auth real: admin.html manda 'Authorization: Bearer session.access_token'
-- en todas las llamadas a /rest/v1/noticias y usa el mismo cliente (con sesión)
-- para subir a storage. Verificado el 2026-08-05.
--
-- Con la política vieja viva, cualquiera con la publishable key —que está en el
-- HTML de todas las páginas, como corresponde— puede crear, editar y borrar
-- noticias y borrar fotos del bucket. El login del admin frena la interfaz,
-- no la base.
--
-- QUÉ HACE ESTA MIGRACIÓN
-- Reemplaza el rol `anon` por `authenticated` en las tres políticas de
-- escritura. La LECTURA PÚBLICA NO SE TOCA: el sitio sigue mostrando las
-- noticias publicadas y las fotos sin login.
--
-- CÓMO SE APLICA
-- Supabase → SQL Editor → pegar y ejecutar. Es idempotente: se puede correr
-- más de una vez sin efecto adicional.
-- ════════════════════════════════════════════════════════

BEGIN;

-- ─── Tabla noticias ─────────────────────────────────────
-- Fuera la política permisiva
DROP POLICY IF EXISTS "Anon full access noticias" ON noticias;

-- Escritura solo con sesión iniciada
DROP POLICY IF EXISTS "Authenticated manage noticias" ON noticias;
CREATE POLICY "Authenticated manage noticias" ON noticias
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Lectura pública de publicadas — se recrea igual, por si no existiera
DROP POLICY IF EXISTS "Public read published noticias" ON noticias;
CREATE POLICY "Public read published noticias" ON noticias
  FOR SELECT USING (estado = 'publicado');

-- ─── Storage: bucket noticias-fotos ─────────────────────
DROP POLICY IF EXISTS "Anon upload noticias fotos" ON storage.objects;
DROP POLICY IF EXISTS "Anon delete noticias fotos" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated upload noticias fotos" ON storage.objects;
CREATE POLICY "Authenticated upload noticias fotos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'noticias-fotos');

-- El admin sube con { upsert: true } → un reemplazo hace UPDATE, no solo INSERT
DROP POLICY IF EXISTS "Authenticated update noticias fotos" ON storage.objects;
CREATE POLICY "Authenticated update noticias fotos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'noticias-fotos')
  WITH CHECK (bucket_id = 'noticias-fotos');

DROP POLICY IF EXISTS "Authenticated delete noticias fotos" ON storage.objects;
CREATE POLICY "Authenticated delete noticias fotos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'noticias-fotos');

-- Lectura pública de las fotos — no se toca, se recrea por las dudas
DROP POLICY IF EXISTS "Public read noticias fotos" ON storage.objects;
CREATE POLICY "Public read noticias fotos" ON storage.objects
  FOR SELECT USING (bucket_id = 'noticias-fotos');

COMMIT;

-- ════════════════════════════════════════════════════════
-- VERIFICACIÓN — correr después; ninguna fila debe decir {anon}
-- ════════════════════════════════════════════════════════
-- SELECT policyname, roles, cmd
--   FROM pg_policies
--  WHERE tablename = 'noticias'
--     OR (schemaname = 'storage' AND policyname ILIKE '%noticias fotos%')
--  ORDER BY tablename, policyname;
--
-- Prueba funcional, en este orden:
--   1. Abrir adescruz.com/noticias sin login → la noticia publicada se ve. ✅
--   2. Entrar al admin, crear una noticia de prueba, subirle una foto,
--      editarla y borrarla → todo debe funcionar igual que antes. ✅
--   3. Si el paso 2 falla con 401/403, el admin no está mandando el token:
--      revisar admin.html y NO revertir esta migración a ciegas.
-- ════════════════════════════════════════════════════════
