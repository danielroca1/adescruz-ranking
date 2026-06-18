-- ============================================================
-- ADESCRUZ Database Schema
-- Asociación de Deportes Ecuestres de Santa Cruz, Bolivia
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase Auth users)
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'jinete' CHECK (role IN ('admin', 'jurado', 'jinete')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- JINETES (Riders)
-- ============================================================
CREATE TABLE jinetes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name         TEXT NOT NULL,
  bio               TEXT,
  federation_number TEXT UNIQUE,
  date_of_birth     DATE,
  phone             TEXT,
  avatar_url        TEXT,
  user_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CABALLOS (Horses)
-- ============================================================
CREATE TABLE caballos (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre     TEXT NOT NULL,
  raza       TEXT NOT NULL DEFAULT 'No especificada',
  edad       INTEGER CHECK (edad >= 0 AND edad <= 40),
  sexo       TEXT NOT NULL CHECK (sexo IN ('castrado', 'yegua', 'entero')),
  color      TEXT NOT NULL DEFAULT 'No especificado',
  owner_id   UUID NOT NULL REFERENCES jinetes(id) ON DELETE CASCADE,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CATEGORIAS (Jump heights / competition categories)
-- ============================================================
CREATE TABLE categorias (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre              TEXT NOT NULL UNIQUE,
  altura_cm           INTEGER NOT NULL,
  orden               INTEGER NOT NULL UNIQUE,
  -- Si true, el ranking acumula puntos al CABALLO (independiente del jinete)
  ranking_por_caballo BOOLEAN NOT NULL DEFAULT FALSE,
  -- Si false, los resultados se registran pero NO entran al ranking
  entra_ranking       BOOLEAN NOT NULL DEFAULT TRUE
);

-- Seed 18 categorías oficiales CDS + Abierta
-- Orden sigue la progresión de altura; donde hay misma altura, va primero la de niños
INSERT INTO categorias (nombre, altura_cm, orden, ranking_por_caballo, entra_ranking) VALUES
  ('Futuros Campeones',      60,   1, FALSE, TRUE),
  ('Escuela Menores',        80,   2, FALSE, TRUE),
  ('Escuela Mayores',        80,   3, FALSE, TRUE),
  ('Pre Infantil',           90,   4, FALSE, TRUE),
  ('Fomento Deportivo',      90,   5, FALSE, TRUE),
  ('Caballos Novicios',     100,   6, TRUE,  TRUE),
  ('Infantil C',            100,   7, FALSE, TRUE),
  ('Quinta Categoría',      100,   8, FALSE, TRUE),
  ('Caballos Jóvenes S1',   110,   9, TRUE,  TRUE),
  ('Infantil B',            110,  10, FALSE, TRUE),
  ('Cuarta Categoría',      110,  11, FALSE, TRUE),
  ('Caballos Jóvenes S2',   120,  12, TRUE,  TRUE),
  ('Infantil A',            120,  13, FALSE, TRUE),
  ('Tercera Categoría',     120,  14, FALSE, TRUE),
  ('Pre Juveniles',         130,  15, FALSE, TRUE),
  ('Segunda Categoría',     130,  16, FALSE, TRUE),
  ('Juveniles',             140,  17, FALSE, TRUE),
  ('Primera Categoría',     140,  18, FALSE, TRUE),
  ('Abierta',                 0,  19, FALSE, FALSE);

-- ============================================================
-- CONCURSOS (Competitions / CDS events)
-- ============================================================
CREATE TABLE concursos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre       TEXT NOT NULL,
  numero       INTEGER NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NOT NULL,
  lugar        TEXT NOT NULL,
  ciudad       TEXT NOT NULL DEFAULT 'Santa Cruz de la Sierra',
  temporada    INTEGER NOT NULL,
  estado       TEXT NOT NULL DEFAULT 'upcoming' CHECK (estado IN ('upcoming', 'active', 'completed')),
  descripcion  TEXT,
  imagen_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (numero, temporada)
);

-- ============================================================
-- CONCURSO_DIAS (Competition days)
-- ============================================================
CREATE TABLE concurso_dias (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concurso_id  UUID NOT NULL REFERENCES concursos(id) ON DELETE CASCADE,
  fecha        DATE NOT NULL,
  dia_numero   INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (concurso_id, dia_numero)
);

-- ============================================================
-- PRUEBAS (Rounds / classes within a competition day)
-- ============================================================
CREATE TABLE pruebas (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concurso_dia_id  UUID NOT NULL REFERENCES concurso_dias(id) ON DELETE CASCADE,
  categoria_id     UUID NOT NULL REFERENCES categorias(id),
  nombre           TEXT NOT NULL,
  articulo         TEXT,
  orden            INTEGER NOT NULL DEFAULT 1,
  estado           TEXT NOT NULL DEFAULT 'pending' CHECK (estado IN ('pending', 'completed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RESULTADOS (Competition results per binomio per prueba)
-- ============================================================
CREATE TABLE resultados (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prueba_id           UUID NOT NULL REFERENCES pruebas(id) ON DELETE CASCADE,
  jinete_id           UUID NOT NULL REFERENCES jinetes(id),
  caballo_id          UUID NOT NULL REFERENCES caballos(id),
  posicion            INTEGER CHECK (posicion >= 1),
  faltas              NUMERIC(5,2) CHECK (faltas >= 0),
  tiempo_seg          NUMERIC(8,3) CHECK (tiempo_seg >= 0),
  penalizacion_tiempo NUMERIC(5,2) CHECK (penalizacion_tiempo >= 0) DEFAULT 0,
  estado_resultado    TEXT NOT NULL DEFAULT 'completed'
    CHECK (estado_resultado IN ('completed', 'ELM', 'RET', 'NSP')),
  puntos_asignados    INTEGER NOT NULL DEFAULT 0 CHECK (puntos_asignados >= 0),
  uploaded_by         UUID NOT NULL REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (prueba_id, jinete_id, caballo_id)
);

-- ============================================================
-- RANKING (Materialized ranking per binomio per categoria per season)
-- ============================================================
CREATE TABLE ranking (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- NULL para categorías ranking_por_caballo = true (CJ S1, CJ S2, Caballos Novicios)
  jinete_id       UUID REFERENCES jinetes(id) ON DELETE CASCADE,
  caballo_id      UUID NOT NULL REFERENCES caballos(id) ON DELETE CASCADE,
  categoria_id    UUID NOT NULL REFERENCES categorias(id),
  temporada       INTEGER NOT NULL,
  puntos_total    INTEGER NOT NULL DEFAULT 0,
  posicion        INTEGER,
  cds_count       INTEGER NOT NULL DEFAULT 0,
  puntos_por_cds  JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Para categorías por caballo: jinete_id es NULL, unicidad solo por caballo
  -- Para binomios normales: unicidad por jinete + caballo
  UNIQUE NULLS NOT DISTINCT (jinete_id, caballo_id, categoria_id, temporada)
);

-- ============================================================
-- NOTICIAS (News articles)
-- ============================================================
CREATE TABLE noticias (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo             TEXT NOT NULL,
  contenido          TEXT NOT NULL,
  imagen_url         TEXT,
  autor_id           UUID NOT NULL REFERENCES profiles(id),
  publicado          BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_publicacion  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SITE CONFIG (Key-value store for admin settings)
-- ============================================================
CREATE TABLE site_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- Seed default config values
INSERT INTO site_config (key, value) VALUES
  ('temporada_activa', '2026'),
  ('nombre_organizacion', '"ADESCRUZ"'),
  ('nombre_completo', '"Asociación de Deportes Ecuestres de Santa Cruz"'),
  ('ciudad', '"Santa Cruz de la Sierra, Bolivia"');

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_resultados_prueba_id     ON resultados(prueba_id);
CREATE INDEX idx_resultados_jinete_id     ON resultados(jinete_id);
CREATE INDEX idx_resultados_caballo_id    ON resultados(caballo_id);
CREATE INDEX idx_pruebas_concurso_dia_id  ON pruebas(concurso_dia_id);
CREATE INDEX idx_pruebas_categoria_id     ON pruebas(categoria_id);
CREATE INDEX idx_concurso_dias_concurso   ON concurso_dias(concurso_id);
CREATE INDEX idx_ranking_temporada        ON ranking(temporada);
CREATE INDEX idx_ranking_categoria        ON ranking(categoria_id);
CREATE INDEX idx_ranking_puntos           ON ranking(categoria_id, temporada, puntos_total DESC);
CREATE INDEX idx_jinetes_user_id          ON jinetes(user_id);
CREATE INDEX idx_caballos_owner           ON caballos(owner_id);
CREATE INDEX idx_noticias_publicado       ON noticias(publicado, fecha_publicacion DESC);

-- ============================================================
-- FUNCTION: Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'jinete')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- FUNCTION: Calculate points based on position and faults
-- ============================================================
CREATE OR REPLACE FUNCTION calcular_puntos(
  p_posicion INTEGER,
  p_faltas NUMERIC,
  p_estado TEXT
) RETURNS INTEGER AS $$
BEGIN
  -- No points for non-finishers or >12 faults
  IF p_estado IN ('ELM', 'RET', 'NSP') THEN
    RETURN 0;
  END IF;
  IF p_faltas IS NOT NULL AND p_faltas > 12 THEN
    RETURN 0;
  END IF;
  -- Points by position
  RETURN CASE p_posicion
    WHEN 1 THEN 7
    WHEN 2 THEN 5
    WHEN 3 THEN 4
    WHEN 4 THEN 3
    WHEN 5 THEN 2
    ELSE 1
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- FUNCTION: Recalculate ranking for a categoria + temporada
-- Handles two modes:
--   ranking_por_caballo = true  → aggregates by caballo only (CJ S1/S2, Novicios)
--   ranking_por_caballo = false → aggregates by jinete + caballo (binomio)
-- Categorías with entra_ranking = false are skipped entirely.
--
-- SCORING RULES (Reglamento Técnico Nacional 2026):
--   Puntos se asignan POR DÍA individual (nunca combinado sábado+domingo / FDS).
--   cds_count = días de competencia en que el binomio participó (tiene resultado).
--   Participación incluye ELM y RET (participaron pero fueron eliminados/retirados).
--   NSP cuenta como participación también (siguiendo lógica AGGREGATE del Excel).
--   "X" (sin resultado registrado) = no participó = no cuenta.
-- ============================================================
CREATE OR REPLACE FUNCTION recalcular_ranking(
  p_categoria_id UUID,
  p_temporada INTEGER
) RETURNS VOID AS $$
DECLARE
  r RECORD;
  v_por_caballo BOOLEAN;
  v_entra_ranking BOOLEAN;
BEGIN
  -- Check category flags
  SELECT ranking_por_caballo, entra_ranking
    INTO v_por_caballo, v_entra_ranking
    FROM categorias WHERE id = p_categoria_id;

  -- Skip non-ranking categories (e.g. Abierta)
  IF NOT v_entra_ranking THEN
    RETURN;
  END IF;

  IF v_por_caballo THEN
    -- ── MODE: rank by HORSE only ─────────────────────────────
    -- Agrupamos por día (concurso_dia_id), nunca por fin de semana completo.
    -- Incluimos todos los estados para que ELM/RET/NSP cuenten como día participado
    -- (puntos_asignados = 0 en esos casos, no afecta la suma).
    FOR r IN
      SELECT
        res.caballo_id,
        cd.id AS dia_id,
        SUM(res.puntos_asignados) AS puntos_dia
      FROM resultados res
      JOIN pruebas pr ON pr.id = res.prueba_id
      JOIN concurso_dias cd ON cd.id = pr.concurso_dia_id
      JOIN concursos c ON c.id = cd.concurso_id
      WHERE pr.categoria_id = p_categoria_id
        AND c.temporada = p_temporada
      GROUP BY res.caballo_id, cd.id
    LOOP
      INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
      VALUES (NULL, r.caballo_id, p_categoria_id, p_temporada,
              jsonb_build_object(r.dia_id::TEXT, r.puntos_dia),
              1, r.puntos_dia, NOW())
      ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE
        SET puntos_por_cds = ranking.puntos_por_cds || jsonb_build_object(r.dia_id::TEXT, r.puntos_dia),
            updated_at = NOW();
    END LOOP;

  ELSE
    -- ── MODE: rank by BINOMIO (jinete + caballo) ─────────────
    -- Ídem: un registro por día, no por fin de semana.
    FOR r IN
      SELECT
        res.jinete_id,
        res.caballo_id,
        cd.id AS dia_id,
        SUM(res.puntos_asignados) AS puntos_dia
      FROM resultados res
      JOIN pruebas pr ON pr.id = res.prueba_id
      JOIN concurso_dias cd ON cd.id = pr.concurso_dia_id
      JOIN concursos c ON c.id = cd.concurso_id
      WHERE pr.categoria_id = p_categoria_id
        AND c.temporada = p_temporada
      GROUP BY res.jinete_id, res.caballo_id, cd.id
    LOOP
      INSERT INTO ranking (jinete_id, caballo_id, categoria_id, temporada, puntos_por_cds, cds_count, puntos_total, updated_at)
      VALUES (r.jinete_id, r.caballo_id, p_categoria_id, p_temporada,
              jsonb_build_object(r.dia_id::TEXT, r.puntos_dia),
              1, r.puntos_dia, NOW())
      ON CONFLICT (jinete_id, caballo_id, categoria_id, temporada) DO UPDATE
        SET puntos_por_cds = ranking.puntos_por_cds || jsonb_build_object(r.dia_id::TEXT, r.puntos_dia),
            updated_at = NOW();
    END LOOP;
  END IF;

  -- Recalculate totals
  -- puntos_por_cds keys = concurso_dia IDs → COUNT(*) = días participados
  UPDATE ranking r
  SET
    puntos_total = (SELECT SUM(value::INTEGER) FROM jsonb_each_text(r.puntos_por_cds)),
    cds_count    = (SELECT COUNT(*) FROM jsonb_each_text(r.puntos_por_cds)),
    updated_at   = NOW()
  WHERE r.categoria_id = p_categoria_id AND r.temporada = p_temporada;

  -- Assign positions (tiebreak: fewer days participated = better, menor participación por exceso)
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY puntos_total DESC, cds_count ASC) AS pos
    FROM ranking
    WHERE categoria_id = p_categoria_id AND temporada = p_temporada
  )
  UPDATE ranking r SET posicion = ranked.pos
  FROM ranked WHERE ranked.id = r.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE jinetes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE caballos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias       ENABLE ROW LEVEL SECURITY;
ALTER TABLE concursos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE concurso_dias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pruebas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking          ENABLE ROW LEVEL SECURITY;
ALTER TABLE noticias         ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config      ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ---- PROFILES ----
CREATE POLICY "profiles_select_own"   ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_update_own"   ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_admin_all"    ON profiles FOR ALL USING (current_user_role() = 'admin');

-- ---- JINETES ----
-- Public read
CREATE POLICY "jinetes_public_read"   ON jinetes FOR SELECT USING (true);
-- Jinete can update their own row (linked via user_id)
CREATE POLICY "jinetes_update_own"    ON jinetes FOR UPDATE USING (user_id = auth.uid());
-- Admin full access
CREATE POLICY "jinetes_admin_all"     ON jinetes FOR ALL USING (current_user_role() = 'admin');

-- ---- CABALLOS ----
-- Public read
CREATE POLICY "caballos_public_read"  ON caballos FOR SELECT USING (true);
-- Owner (jinete) can manage their horses
CREATE POLICY "caballos_owner_manage" ON caballos FOR ALL
  USING (owner_id IN (SELECT id FROM jinetes WHERE user_id = auth.uid()));
-- Admin full access
CREATE POLICY "caballos_admin_all"    ON caballos FOR ALL USING (current_user_role() = 'admin');

-- ---- CATEGORIAS (public read-only, admin write) ----
CREATE POLICY "categorias_public_read" ON categorias FOR SELECT USING (true);
CREATE POLICY "categorias_admin_write" ON categorias FOR ALL USING (current_user_role() = 'admin');

-- ---- CONCURSOS (public read, admin write) ----
CREATE POLICY "concursos_public_read" ON concursos FOR SELECT USING (true);
CREATE POLICY "concursos_admin_write" ON concursos FOR ALL USING (current_user_role() = 'admin');

-- ---- CONCURSO_DIAS (public read, admin write) ----
CREATE POLICY "concurso_dias_public_read" ON concurso_dias FOR SELECT USING (true);
CREATE POLICY "concurso_dias_admin_write" ON concurso_dias FOR ALL USING (current_user_role() = 'admin');

-- ---- PRUEBAS (public read, admin + jurado write) ----
CREATE POLICY "pruebas_public_read"        ON pruebas FOR SELECT USING (true);
CREATE POLICY "pruebas_admin_jurado_write" ON pruebas FOR ALL
  USING (current_user_role() IN ('admin', 'jurado'));

-- ---- RESULTADOS ----
-- Public read
CREATE POLICY "resultados_public_read"       ON resultados FOR SELECT USING (true);
-- Jurado can insert (upload results)
CREATE POLICY "resultados_jurado_insert"     ON resultados FOR INSERT
  WITH CHECK (current_user_role() IN ('admin', 'jurado'));
-- Only admin can update/delete
CREATE POLICY "resultados_admin_modify"      ON resultados FOR UPDATE USING (current_user_role() = 'admin');
CREATE POLICY "resultados_admin_delete"      ON resultados FOR DELETE USING (current_user_role() = 'admin');

-- ---- RANKING (public read, admin write) ----
CREATE POLICY "ranking_public_read"  ON ranking FOR SELECT USING (true);
CREATE POLICY "ranking_admin_write"  ON ranking FOR ALL USING (current_user_role() = 'admin');

-- ---- NOTICIAS ----
-- Public can read published news
CREATE POLICY "noticias_public_read"  ON noticias FOR SELECT USING (publicado = true);
-- Admin can see and manage all
CREATE POLICY "noticias_admin_all"    ON noticias FOR ALL USING (current_user_role() = 'admin');

-- ---- SITE_CONFIG (admin only) ----
CREATE POLICY "site_config_admin_read"  ON site_config FOR SELECT USING (current_user_role() = 'admin');
CREATE POLICY "site_config_admin_write" ON site_config FOR ALL   USING (current_user_role() = 'admin');

-- ============================================================
-- STORAGE BUCKETS (run these via Supabase dashboard or API)
-- ============================================================
-- bucket: 'avatars'   (public)  — jinete/user profile photos
-- bucket: 'resultados' (private) — Excel/PDF uploads by jurado
-- bucket: 'noticias'  (public)  — news article images
-- bucket: 'concursos' (public)  — competition banner images
