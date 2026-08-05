-- ============================================================
-- RANKING CDS2 UPDATE - from Excel RANKING 2026
-- Generated from V2_RANKING_DEPARTAMENTAL_2026_actualizado_Claude.xlsx
-- NOTA: Carlos Zamorano (Esc. Mayores)=1pt, Sara Zelaya=1pt (per Excel)
-- ============================================================

-- [Futuros Campeones] Thomas Cespedes Landivar / Mlm Alcapone = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Mlm Alcapone'
JOIN categorias c ON c.nombre = 'Futuros Campeones'
WHERE j.nombre ILIKE '%Thomas%C_spedes%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Futuros Campeones] Samuel Simon Rocha / Sortilegio = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Sortilegio'
JOIN categorias c ON c.nombre = 'Futuros Campeones'
WHERE j.nombre ILIKE 'Samuel Simon Rocha'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Futuros Campeones] Samuel Simon Rocha / Belen = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Belen'
JOIN categorias c ON c.nombre = 'Futuros Campeones'
WHERE j.nombre ILIKE 'Samuel Simon Rocha'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Futuros Campeones] Claudia Barriga Soliz / Belen = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Belen'
JOIN categorias c ON c.nombre = 'Futuros Campeones'
WHERE j.nombre ILIKE 'Claudia Barriga Soliz'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Futuros Campeones] Breana Ross / Carmenier = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Carmenier'
JOIN categorias c ON c.nombre = 'Futuros Campeones'
WHERE j.nombre ILIKE 'Breana Ross'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Futuros Campeones] Francisca Roca / Henriquito = 5pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 5}'::jsonb, 1, 5, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Henriquito'
JOIN categorias c ON c.nombre = 'Futuros Campeones'
WHERE j.nombre ILIKE 'Francisca Roca'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 5}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 5}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 5}'::jsonb)),
  updated_at = NOW();

-- [Futuros Campeones] Isabella Trujillo / Zion = 5pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 5}'::jsonb, 1, 5, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Zion'
JOIN categorias c ON c.nombre = 'Futuros Campeones'
WHERE j.nombre ILIKE '%Isabella Trujillo%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 5}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 5}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 5}'::jsonb)),
  updated_at = NOW();

-- [Futuros Campeones] Bruna Gutierrez / Amanda = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Amanda'
JOIN categorias c ON c.nombre = 'Futuros Campeones'
WHERE j.nombre ILIKE 'Bruna Gutierrez'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Futuros Campeones] Andrea Victoria Galvan Sejas / Sinfonia = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Sinfonia'
JOIN categorias c ON c.nombre = 'Futuros Campeones'
WHERE j.nombre ILIKE '%Andrea%Galvan%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Futuros Campeones] Valentina Castedo / Bubbalu = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Bubbalu'
JOIN categorias c ON c.nombre = 'Futuros Campeones'
WHERE j.nombre ILIKE 'Valentina Castedo'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Futuros Campeones] Nataly Parada / Amanda = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Amanda'
JOIN categorias c ON c.nombre = 'Futuros Campeones'
WHERE j.nombre ILIKE 'Nataly Parada'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Futuros Campeones] Anialia Soljancic Aguilera / Lalo = 0pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 0}'::jsonb, 1, 0, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Lalo'
JOIN categorias c ON c.nombre = 'Futuros Campeones'
WHERE j.nombre ILIKE '%Anialia%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 0}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 0}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 0}'::jsonb)),
  updated_at = NOW();

-- [Futuros Campeones] Luciana Dominguez Tavera / Carmenier = 0pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 0}'::jsonb, 1, 0, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Carmenier'
JOIN categorias c ON c.nombre = 'Futuros Campeones'
WHERE j.nombre ILIKE '%Luciana%Dominguez%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 0}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 0}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 0}'::jsonb)),
  updated_at = NOW();

-- [Futuros Campeones] Annie Balazs / Alfajor = 0pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 0}'::jsonb, 1, 0, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Alfajor'
JOIN categorias c ON c.nombre = 'Futuros Campeones'
WHERE j.nombre ILIKE '%Annie%Balaz%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 0}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 0}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 0}'::jsonb)),
  updated_at = NOW();

-- [Escuela Menores] Antonella Bejarano / América Da Riviera = 4pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 4}'::jsonb, 1, 4, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE '%América%Da%Riviera%'
JOIN categorias c ON c.nombre = 'Escuela Menores'
WHERE j.nombre ILIKE '%Antonella%Bejarano%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 4}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 4}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 4}'::jsonb)),
  updated_at = NOW();

-- [Escuela Menores] Zoe Alvarez Vaca / Toby = 1pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 1}'::jsonb, 1, 1, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Toby'
JOIN categorias c ON c.nombre = 'Escuela Menores'
WHERE j.nombre ILIKE '%Zoe%Alvarez%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 1}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  updated_at = NOW();

-- [Escuela Menores] Antonella Bejarano / Pocahonta = 2pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 2}'::jsonb, 1, 2, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Pocahonta'
JOIN categorias c ON c.nombre = 'Escuela Menores'
WHERE j.nombre ILIKE '%Antonella%Bejarano%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 2}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 2}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 2}'::jsonb)),
  updated_at = NOW();

-- [Escuela Menores] Catalina Montaño / Kiara = 5pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 5}'::jsonb, 1, 5, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Kiara'
JOIN categorias c ON c.nombre = 'Escuela Menores'
WHERE j.nombre ILIKE '%Catalina%Monta%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 5}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 5}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 5}'::jsonb)),
  updated_at = NOW();

-- [Escuela Menores] Amanda Aponte / Sinfonia = 1pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 1}'::jsonb, 1, 1, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Sinfonia'
JOIN categorias c ON c.nombre = 'Escuela Menores'
WHERE j.nombre ILIKE 'Amanda Aponte'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 1}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  updated_at = NOW();

-- [Escuela Menores] Antonia Numberg Miserendino / Ónix Pullman = 1pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 1}'::jsonb, 1, 1, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE '%nix Pullman%'
JOIN categorias c ON c.nombre = 'Escuela Menores'
WHERE j.nombre ILIKE '%Antonia%Numberg%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 1}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  updated_at = NOW();

-- [Escuela Menores] Melek Montenegro / Anita = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Anita'
JOIN categorias c ON c.nombre = 'Escuela Menores'
WHERE j.nombre ILIKE 'Melek Montenegro'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Escuela Menores] Sofia Gallardo / Milky Way = 4pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 4}'::jsonb, 1, 4, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Milky Way'
JOIN categorias c ON c.nombre = 'Escuela Menores'
WHERE j.nombre ILIKE '%Sofia%Gallardo%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 4}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 4}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 4}'::jsonb)),
  updated_at = NOW();

-- [Escuela Menores] Antonia Numberg Miserendino / Vega = 3pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 3}'::jsonb, 1, 3, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Vega'
JOIN categorias c ON c.nombre = 'Escuela Menores'
WHERE j.nombre ILIKE '%Antonia%Numberg%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 3}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 3}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 3}'::jsonb)),
  updated_at = NOW();

-- [Escuela Menores] Julieta Justiniano / Adele = 1pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 1}'::jsonb, 1, 1, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Adele'
JOIN categorias c ON c.nombre = 'Escuela Menores'
WHERE j.nombre ILIKE '%Julieta%Justiniano%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 1}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  updated_at = NOW();

-- [Escuela Mayores] Mara Uncal / D'Orion = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE '%D%orion%'
JOIN categorias c ON c.nombre = 'Escuela Mayores'
WHERE j.nombre ILIKE 'Mara Uncal'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Escuela Mayores] Camila Mamani / Wetel = 2pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 2}'::jsonb, 1, 2, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Wetel'
JOIN categorias c ON c.nombre = 'Escuela Mayores'
WHERE j.nombre ILIKE 'Camila Mamani'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 2}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 2}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 2}'::jsonb)),
  updated_at = NOW();

-- [Escuela Mayores] Carlos Zamorano / Conquistador = 1pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 1}'::jsonb, 1, 1, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Conquistador'
JOIN categorias c ON c.nombre = 'Escuela Mayores'
WHERE j.nombre ILIKE '%Carlos%Zamorano%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 1}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  updated_at = NOW();

-- [Escuela Mayores] Azul Pantoja / Bacardi = 5pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 5}'::jsonb, 1, 5, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Bacardi'
JOIN categorias c ON c.nombre = 'Escuela Mayores'
WHERE j.nombre ILIKE '%Azul%Pantoja%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 5}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 5}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 5}'::jsonb)),
  updated_at = NOW();

-- [Escuela Mayores] Margarita Lopez / Santa Ana Angela = 4pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 4}'::jsonb, 1, 4, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE '%Santa Ana%Angela%'
JOIN categorias c ON c.nombre = 'Escuela Mayores'
WHERE j.nombre ILIKE '%Margarita%Lopez%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 4}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 4}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 4}'::jsonb)),
  updated_at = NOW();

-- [Escuela Mayores] Fharid Galvis / Papi = 3pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 3}'::jsonb, 1, 3, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Papi'
JOIN categorias c ON c.nombre = 'Escuela Mayores'
WHERE j.nombre ILIKE '%Fharid%Galvis%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 3}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 3}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 3}'::jsonb)),
  updated_at = NOW();

-- [Escuela Mayores] Sara Zelaya / Bacardi = 1pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 1}'::jsonb, 1, 1, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Bacardi'
JOIN categorias c ON c.nombre = 'Escuela Mayores'
WHERE j.nombre ILIKE '%Sara%Zelaya%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 1}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  updated_at = NOW();

-- [Pre Infantil] Aitana Sardan / La Marianita Quantino = 4pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 4}'::jsonb, 1, 4, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE '%Marianita%'
JOIN categorias c ON c.nombre = 'Pre Infantil'
WHERE j.nombre ILIKE '%Aitana%Sardan%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 4}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 4}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 4}'::jsonb)),
  updated_at = NOW();

-- [Pre Infantil] Camila Montaño / Aurora = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Aurora'
JOIN categorias c ON c.nombre = 'Pre Infantil'
WHERE j.nombre ILIKE '%Camila%Monta%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Pre Infantil] Alina Arce / Paris = 3pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 3}'::jsonb, 1, 3, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Paris'
JOIN categorias c ON c.nombre = 'Pre Infantil'
WHERE j.nombre ILIKE 'Alina Arce'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 3}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 3}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 3}'::jsonb)),
  updated_at = NOW();

-- [Pre Infantil] Sarah Viera / Channel = 5pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 5}'::jsonb, 1, 5, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Channel'
JOIN categorias c ON c.nombre = 'Pre Infantil'
WHERE j.nombre ILIKE '%Sarah%Viera%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 5}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 5}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 5}'::jsonb)),
  updated_at = NOW();

-- [Fomento Deportivo] Sandra Pascual / Zafira = 2pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 2}'::jsonb, 1, 2, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Zafira'
JOIN categorias c ON c.nombre = 'Fomento Deportivo'
WHERE j.nombre ILIKE 'Sandra Pascual'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 2}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 2}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 2}'::jsonb)),
  updated_at = NOW();

-- [Fomento Deportivo] Catalina Fuertes / Big Brown = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Big Brown'
JOIN categorias c ON c.nombre = 'Fomento Deportivo'
WHERE j.nombre ILIKE '%Catalina%Fuertes%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Fomento Deportivo] Monserrat Roca / Tango = 3pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 3}'::jsonb, 1, 3, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Tango'
JOIN categorias c ON c.nombre = 'Fomento Deportivo'
WHERE j.nombre ILIKE '%Monserrat%Roca%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 3}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 3}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 3}'::jsonb)),
  updated_at = NOW();

-- [Fomento Deportivo] Giorgio Yuli / Eureka = 5pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 5}'::jsonb, 1, 5, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Eureka'
JOIN categorias c ON c.nombre = 'Fomento Deportivo'
WHERE j.nombre ILIKE 'Giorgio Yuli'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 5}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 5}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 5}'::jsonb)),
  updated_at = NOW();

-- [Fomento Deportivo] Henry Gutierrez / Troy = 4pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 4}'::jsonb, 1, 4, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Troy'
JOIN categorias c ON c.nombre = 'Fomento Deportivo'
WHERE j.nombre ILIKE '%Henry%Gutierrez%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 4}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 4}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 4}'::jsonb)),
  updated_at = NOW();

-- [Fomento Deportivo] Jorge Bellido / Lluvia = 1pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 1}'::jsonb, 1, 1, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Lluvia'
JOIN categorias c ON c.nombre = 'Fomento Deportivo'
WHERE j.nombre ILIKE 'Jorge Bellido'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 1}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  updated_at = NOW();

-- [Fomento Deportivo] Irene Legonia / Yucatan = 1pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 1}'::jsonb, 1, 1, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Yucatan'
JOIN categorias c ON c.nombre = 'Fomento Deportivo'
WHERE j.nombre ILIKE 'Irene Legonia'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 1}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  updated_at = NOW();

-- [Fomento Deportivo] Micaela Navia / Idalina Rex = 1pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 1}'::jsonb, 1, 1, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Idalina Rex'
JOIN categorias c ON c.nombre = 'Fomento Deportivo'
WHERE j.nombre ILIKE '%Micaela%Navia%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 1}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 1}'::jsonb)),
  updated_at = NOW();

-- [Infantil C] Miranda Cespedes / Mlm Poker Z = 5pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 5}'::jsonb, 1, 5, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE '%Poker Z%'
JOIN categorias c ON c.nombre = 'Infantil C'
WHERE j.nombre ILIKE '%Miranda%C_spedes%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 5}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 5}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 5}'::jsonb)),
  updated_at = NOW();

-- [Infantil C] Aldana Peredo / Camelot = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Camelot'
JOIN categorias c ON c.nombre = 'Infantil C'
WHERE j.nombre ILIKE 'Aldana Peredo'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Infantil C] Luciana Angulo / Zafiro = 4pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 4}'::jsonb, 1, 4, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Zafiro'
JOIN categorias c ON c.nombre = 'Infantil C'
WHERE j.nombre ILIKE '%Luciana%Angulo%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 4}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 4}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 4}'::jsonb)),
  updated_at = NOW();

-- [Quinta Categoría] Camila Moscoso / Kaiser = 0pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 0}'::jsonb, 1, 0, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Kaiser'
JOIN categorias c ON c.nombre = 'Quinta Categoría'
WHERE j.nombre ILIKE 'Camila Moscoso'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 0}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 0}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 0}'::jsonb)),
  updated_at = NOW();

-- [Quinta Categoría] Julia Maria Hurtado / Omega = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Omega'
JOIN categorias c ON c.nombre = 'Quinta Categoría'
WHERE j.nombre ILIKE '%Julia%Hurtado%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Quinta Categoría] Victoria Argandoña / Dolce Chanel Du Rozel = 5pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 5}'::jsonb, 1, 5, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE '%Dolce%Chanel%'
JOIN categorias c ON c.nombre = 'Quinta Categoría'
WHERE j.nombre ILIKE '%Victoria%Argando%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 5}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 5}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 5}'::jsonb)),
  updated_at = NOW();

-- [Quinta Categoría] Maria Rene Velez / Cinnaboms = 4pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 4}'::jsonb, 1, 4, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE '%Cinnab%'
JOIN categorias c ON c.nombre = 'Quinta Categoría'
WHERE j.nombre ILIKE '%Maria%Rene%Velez%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 4}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 4}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 4}'::jsonb)),
  updated_at = NOW();

-- [Caballos Novicios] Diego Canelas / Oasis = 7pts (horse-based)
DO $$ 
DECLARE v_cab UUID; v_cat UUID;
BEGIN
  SELECT id INTO v_cab FROM caballos WHERE nombre ILIKE 'Oasis' LIMIT 1;
  SELECT id INTO v_cat FROM categorias WHERE nombre = 'Caballos Novicios' LIMIT 1;
  IF v_cab IS NULL OR v_cat IS NULL THEN
    RAISE WARNING 'No encontrado: caballo=Oasis o cat=Caballos Novicios';
  ELSIF EXISTS (SELECT 1 FROM ranking WHERE caballo_id=v_cab AND categoria_id=v_cat AND temporada=2026 AND jinete_id IS NULL) THEN
    UPDATE ranking SET
      puntos_por_cds = puntos_por_cds || '{"2": 7}'::jsonb,
      cds_count = (SELECT COUNT(*) FROM jsonb_each_text(puntos_por_cds || '{"2": 7}'::jsonb)),
      puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(puntos_por_cds || '{"2": 7}'::jsonb)),
      updated_at = NOW()
    WHERE caballo_id=v_cab AND categoria_id=v_cat AND temporada=2026 AND jinete_id IS NULL;
  ELSE
    INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
    VALUES (NULL, v_cab, v_cat, 2026, '{"2": 7}'::jsonb, 1, 7, NOW());
  END IF;
END $$;

-- [Caballos Novicios] Diego Canelas / Chico Guapo = 5pts (horse-based)
DO $$ 
DECLARE v_cab UUID; v_cat UUID;
BEGIN
  SELECT id INTO v_cab FROM caballos WHERE nombre ILIKE 'Chico Guapo' LIMIT 1;
  SELECT id INTO v_cat FROM categorias WHERE nombre = 'Caballos Novicios' LIMIT 1;
  IF v_cab IS NULL OR v_cat IS NULL THEN
    RAISE WARNING 'No encontrado: caballo=Chico Guapo o cat=Caballos Novicios';
  ELSIF EXISTS (SELECT 1 FROM ranking WHERE caballo_id=v_cab AND categoria_id=v_cat AND temporada=2026 AND jinete_id IS NULL) THEN
    UPDATE ranking SET
      puntos_por_cds = puntos_por_cds || '{"2": 5}'::jsonb,
      cds_count = (SELECT COUNT(*) FROM jsonb_each_text(puntos_por_cds || '{"2": 5}'::jsonb)),
      puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(puntos_por_cds || '{"2": 5}'::jsonb)),
      updated_at = NOW()
    WHERE caballo_id=v_cab AND categoria_id=v_cat AND temporada=2026 AND jinete_id IS NULL;
  ELSE
    INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
    VALUES (NULL, v_cab, v_cat, 2026, '{"2": 5}'::jsonb, 1, 5, NOW());
  END IF;
END $$;

-- [Cuarta Categoría] Rodrigo Daza / Tiberius Z = 0pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 0}'::jsonb, 1, 0, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Tiberius Z'
JOIN categorias c ON c.nombre = 'Cuarta Categoría'
WHERE j.nombre ILIKE 'Rodrigo Daza'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 0}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 0}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 0}'::jsonb)),
  updated_at = NOW();

-- [Cuarta Categoría] Fabio Palma / Baral Yaron = 0pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 0}'::jsonb, 1, 0, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Baral Yaron'
JOIN categorias c ON c.nombre = 'Cuarta Categoría'
WHERE j.nombre ILIKE '%Fabio%Palma%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 0}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 0}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 0}'::jsonb)),
  updated_at = NOW();

-- [Cuarta Categoría] Santiago Dorado / Next Funky = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Next Funky'
JOIN categorias c ON c.nombre = 'Cuarta Categoría'
WHERE j.nombre ILIKE 'Santiago Dorado'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Tercera Categoría] Daniel Hanley / Asterope = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Asterope'
JOIN categorias c ON c.nombre = 'Tercera Categoría'
WHERE j.nombre ILIKE 'Daniel Hanley'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- [Segunda Categoría] Mariana Cortez / Deam = 0pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 0}'::jsonb, 1, 0, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Deam'
JOIN categorias c ON c.nombre = 'Segunda Categoría'
WHERE j.nombre ILIKE '%Mariana%Cortez%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 0}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 0}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 0}'::jsonb)),
  updated_at = NOW();

-- [Segunda Categoría] Orlando Montoya / Malcolm = 7pts
INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
SELECT j.id, ca.id, c.id, 2026, '{"2": 7}'::jsonb, 1, 7, NOW()
FROM jinetes j
JOIN caballos ca ON ca.nombre ILIKE 'Malcolm'
JOIN categorias c ON c.nombre = 'Segunda Categoría'
WHERE j.nombre ILIKE '%Orlando%Montoya%'
ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE SET
  puntos_por_cds = ranking.puntos_por_cds || '{"2": 7}'::jsonb,
  cds_count = (SELECT COUNT(*) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  puntos_total = (SELECT SUM(value::int) FROM jsonb_each_text(ranking.puntos_por_cds || '{"2": 7}'::jsonb)),
  updated_at = NOW();

-- ============================================================
-- Recalcular posiciones por categoría
-- ============================================================
WITH ranked AS (
  SELECT id, 
    ROW_NUMBER() OVER (PARTITION BY categoria_id ORDER BY puntos_total DESC, cds_count ASC) AS pos
  FROM ranking
  WHERE temporada = 2026
)
UPDATE ranking r SET posicion = ranked.pos
FROM ranked WHERE ranked.id = r.id;
