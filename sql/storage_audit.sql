-- ============================================================
-- AUDITORÍA DE POLICIES — storage.objects
-- Solo lectura. No modifica nada.
-- ============================================================

-- Q1: TODAS las policies de storage.objects, agrupadas por bucket y comando
SELECT
  policyname,
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
    ELSE cmd::text
  END AS comando,
  roles,
  permissive,
  qual        AS using_expression,
  with_check  AS with_check_expression
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY
  CASE WHEN 'public' = ANY(roles) AND cmd IN ('w','d','*') THEN 0 ELSE 1 END,  -- riesgosas primero
  cmd, policyname;

-- Q2: Lista de buckets y su flag public
SELECT id, name, public, created_at
FROM storage.buckets
ORDER BY id;
