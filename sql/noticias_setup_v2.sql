-- ════════════════════════════════════════════════════════
-- ADESCRUZ — Tabla NOTICIAS v2
-- Eliminación y recreación limpia
-- Ejecutar en Supabase → SQL Editor
-- ════════════════════════════════════════════════════════

-- 1. Eliminar tabla existente (si ya existía mal)
DROP TABLE IF EXISTS noticias CASCADE;

-- 2. Crear tabla limpia
CREATE TABLE noticias (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo           TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  categoria        TEXT NOT NULL DEFAULT 'General',
  fecha_publicacion DATE NOT NULL DEFAULT CURRENT_DATE,
  autor            TEXT DEFAULT 'ADESCRUZ',
  resumen          TEXT,
  cuerpo           TEXT,
  foto_url         TEXT,
  foto_caption     TEXT,
  galeria_activa   BOOLEAN DEFAULT FALSE,
  galeria_fotos    JSONB DEFAULT '[]'::jsonb,
  destacada        BOOLEAN DEFAULT FALSE,
  permitir_compartir BOOLEAN DEFAULT TRUE,
  estado           TEXT DEFAULT 'borrador'
                   CHECK (estado IN ('borrador', 'publicado', 'programado')),
  fecha_programada TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices
CREATE INDEX idx_noticias_slug   ON noticias(slug);
CREATE INDEX idx_noticias_estado ON noticias(estado);
CREATE INDEX idx_noticias_fecha  ON noticias(fecha_publicacion DESC);

-- 4. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS noticias_updated_at ON noticias;
CREATE TRIGGER noticias_updated_at
  BEFORE UPDATE ON noticias
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. RLS
ALTER TABLE noticias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published noticias" ON noticias;
CREATE POLICY "Public read published noticias" ON noticias
  FOR SELECT USING (estado = 'publicado');

DROP POLICY IF EXISTS "Anon full access noticias" ON noticias;
CREATE POLICY "Anon full access noticias" ON noticias
  FOR ALL USING (true) WITH CHECK (true);

-- 6. Dato de prueba
INSERT INTO noticias (titulo, slug, categoria, fecha_publicacion, autor, resumen, cuerpo, destacada, estado)
VALUES (
  'Bienvenidos a la temporada 2026',
  'bienvenida-temporada-2026',
  'General',
  '2026-01-19',
  'ADESCRUZ',
  'La Asociación de Deportes Ecuestres de Santa Cruz da inicio a la temporada 2026 del Campeonato Departamental de Salto.',
  'La directiva de ADESCRUZ da la bienvenida a todos los jinetes, amazonas, caballos y familias que forman parte de nuestra comunidad ecuestre.

## Temporada 2026

Este año contamos con 16 fechas programadas en distintas sedes del departamento, incluyendo el Club Hípico Santa Cruz, el Club Hípico La Quinta y SCIS.

## Afiliaciones

Las inscripciones para la temporada 2026 están abiertas. Consultá los requisitos en la sección de Afiliación del sitio web.',
  true,
  'publicado'
);

-- ════════════════════════════════════════════════════════
-- STORAGE (ejecutar DESPUÉS de crear el bucket manualmente)
-- Supabase → Storage → New bucket → "noticias-fotos" → Public
-- ════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Public read noticias fotos" ON storage.objects;
CREATE POLICY "Public read noticias fotos" ON storage.objects
  FOR SELECT USING (bucket_id = 'noticias-fotos');

DROP POLICY IF EXISTS "Anon upload noticias fotos" ON storage.objects;
CREATE POLICY "Anon upload noticias fotos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'noticias-fotos');

DROP POLICY IF EXISTS "Anon delete noticias fotos" ON storage.objects;
CREATE POLICY "Anon delete noticias fotos" ON storage.objects
  FOR DELETE USING (bucket_id = 'noticias-fotos');
