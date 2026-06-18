-- ============================================================
-- ADESCRUZ Database Schema — Extension #2
-- Inscripciones, Afiliaciones, y Solicitudes de Acceso
-- April 2026
-- ============================================================

-- ============================================================
-- AFILIACIONES (Annual affiliation/membership applications)
-- ============================================================
CREATE TABLE afiliaciones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  temporada       TEXT NOT NULL,
  jinete_id       UUID REFERENCES jinetes(id) ON DELETE SET NULL,
  nombre          TEXT NOT NULL,
  email           TEXT NOT NULL,
  celular         TEXT NOT NULL,
  club            TEXT NOT NULL,
  categoria_id    INTEGER NOT NULL REFERENCES categorias(id),
  nombre_caballo  TEXT NOT NULL,
  comprobante_url TEXT,
  estado          TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  notas_admin     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_afiliaciones_temporada ON afiliaciones(temporada);
CREATE INDEX idx_afiliaciones_estado ON afiliaciones(estado);
CREATE INDEX idx_afiliaciones_email ON afiliaciones(email);
CREATE INDEX idx_afiliaciones_jinete ON afiliaciones(jinete_id);

-- ============================================================
-- INSCRIPCIONES (Per-competition registration/entry forms)
-- ============================================================
CREATE TABLE inscripciones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concurso_id     TEXT NOT NULL,
  nombre          TEXT NOT NULL,
  celular         TEXT NOT NULL,
  cat_oficial     TEXT NOT NULL,
  club            TEXT NOT NULL,
  equino          TEXT NOT NULL,
  cat_concurso    TEXT NOT NULL,
  dias            TEXT NOT NULL CHECK (dias IN ('ambos', 'sabado', 'domingo')),
  comprobante_url TEXT,
  estado          TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'rechazado')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inscripciones_concurso ON inscripciones(concurso_id);
CREATE INDEX idx_inscripciones_estado ON inscripciones(estado);
CREATE INDEX idx_inscripciones_nombre ON inscripciones(nombre);

-- ============================================================
-- SOLICITUDES_ACCESO (User access requests for admin/jurado roles)
-- ============================================================
CREATE TABLE solicitudes_acceso (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre     TEXT NOT NULL,
  email      TEXT NOT NULL,
  rol        TEXT NOT NULL CHECK (rol IN ('admin', 'jurado', 'jinete')),
  estado     TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  notas      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(email, rol)
);

CREATE INDEX idx_solicitudes_acceso_estado ON solicitudes_acceso(estado);
CREATE INDEX idx_solicitudes_acceso_email ON solicitudes_acceso(email);
CREATE INDEX idx_solicitudes_acceso_rol ON solicitudes_acceso(rol);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE afiliaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE inscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_acceso ENABLE ROW LEVEL SECURITY;

-- ---- AFILIACIONES ----
-- Public: insert new affiliations (open form submission)
CREATE POLICY "afiliaciones_public_insert" ON afiliaciones
  FOR INSERT WITH CHECK (true);

-- Admin: read and manage all
CREATE POLICY "afiliaciones_admin_all" ON afiliaciones
  FOR ALL USING (current_user_role() = 'admin');

-- ---- INSCRIPCIONES ----
-- Public: insert new inscriptions (open form submission)
CREATE POLICY "inscripciones_public_insert" ON inscripciones
  FOR INSERT WITH CHECK (true);

-- Admin: read and manage all
CREATE POLICY "inscripciones_admin_all" ON inscripciones
  FOR ALL USING (current_user_role() = 'admin');

-- ---- SOLICITUDES_ACCESO ----
-- Public: insert new access requests (open form submission)
CREATE POLICY "solicitudes_acceso_public_insert" ON solicitudes_acceso
  FOR INSERT WITH CHECK (true);

-- Admin: read and manage all
CREATE POLICY "solicitudes_acceso_admin_all" ON solicitudes_acceso
  FOR ALL USING (current_user_role() = 'admin');

-- ============================================================
-- TRIGGER: Auto-update updated_at timestamps
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER afiliaciones_updated_at
  BEFORE UPDATE ON afiliaciones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER inscripciones_updated_at
  BEFORE UPDATE ON inscripciones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER solicitudes_acceso_updated_at
  BEFORE UPDATE ON solicitudes_acceso
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- STORAGE BUCKETS (Create via Supabase Dashboard)
-- ============================================================
-- bucket: 'afiliaciones'   (private)  — affiliation proof-of-payment documents
-- bucket: 'inscripciones'  (private)  — competition inscription proof-of-payment documents
