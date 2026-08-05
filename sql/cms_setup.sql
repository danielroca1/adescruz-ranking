-- ADESCRUZ CMS Setup for Supabase
-- Tables: site_config, page_content
-- Generated: 2026-04-11

-- ============================================================================
-- 1. Table: site_config
-- ============================================================================
DROP TABLE IF EXISTS site_config CASCADE;
CREATE TABLE site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read site_config" ON site_config
  FOR SELECT USING (true);

CREATE POLICY "Admins can modify site_config" ON site_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE id = auth.uid() AND rol IN ('superadmin', 'admin')
    )
  );

-- ============================================================================
-- 2. INSERT inicial: site_config (idempotent with ON CONFLICT DO UPDATE)
-- ============================================================================
INSERT INTO site_config (key, value) VALUES
  ('logo_emoji', U&'\+01F3C7'),
  ('logo_text', 'ADESCRUZ'),
  ('color_green', '#1a4731'),
  ('color_green2', '#2d6a4f'),
  ('color_green_bg', '#f0f7f4'),
  ('color_gold', '#c9a84c'),
  ('font_family', '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'),
  ('footer_facebook', 'https://facebook.com/adescruz'),
  ('footer_instagram', 'https://instagram.com/adescruz'),
  ('footer_youtube', 'https://youtube.com/@adescruz'),
  ('footer_whatsapp', ''),
  ('footer_copyright', 'Todos los derechos reservados — ADESCRUZ 2026')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- ============================================================================
-- 3. Table: page_content
-- ============================================================================
DROP TABLE IF EXISTS page_content CASCADE;
CREATE TABLE page_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  page TEXT NOT NULL,
  block TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page, block)
);

ALTER TABLE page_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read page_content" ON page_content
  FOR SELECT USING (true);

CREATE POLICY "Admins can modify page_content" ON page_content
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE id = auth.uid() AND rol IN ('superadmin', 'admin')
    )
  );

-- ============================================================================
-- 4. INSERT inicial: page_content (page = 'index')
--    idempotent with ON CONFLICT DO UPDATE
-- ============================================================================
INSERT INTO page_content (page, block, data) VALUES
  (
    'index',
    'card_ranking',
    '{"label":"Temporada 2026","title":"Ranking Departamental","desc":"Posiciones actualizadas por categoría. Puntos acumulados en la temporada 2026.","link":"/ranking","link_text":"Ver ranking →"}'::jsonb
  ),
  (
    'index',
    'card_inscripcion',
    '{"label":"IV CDS · Abierto","title":"Inscripción al Concurso","desc":"Formulario oficial para el próximo CDS. Cierre: viernes previo a las 15:00 hs.","link":"/inscripcion","link_text":"Inscribirme →"}'::jsonb
  ),
  (
    'index',
    'card_calendario',
    '{"label":"17 CDS · 2026","title":"Calendario Oficial","desc":"Fechas, sedes y estado de todos los concursos de la temporada 2026.","link":"/calendario","link_text":"Ver calendario →"}'::jsonb
  )
ON CONFLICT (page, block) DO UPDATE SET
  data = EXCLUDED.data,
  updated_at = NOW();
