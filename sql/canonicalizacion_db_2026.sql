-- ══════════════════════════════════════════════════════════════
-- ADESCRUZ — Canonicalización DB 2026
-- Unifica duplicados preexistentes + aplica convención primer apellido
-- ══════════════════════════════════════════════════════════════

BEGIN;

-- Desactivar triggers (session_replication_role) para esta transacción
SET LOCAL session_replication_role = replica;

-- ── Helper: rename o merge ──────────────────────────────────────
CREATE OR REPLACE FUNCTION _rename_jinete(old_name text, new_name text)
RETURNS void AS $$
BEGIN
  UPDATE resultados_pdf SET jinete = new_name WHERE jinete = old_name;
  IF EXISTS (SELECT 1 FROM jinetes WHERE nombre = new_name) THEN
    DELETE FROM jinetes WHERE nombre = old_name;
  ELSE
    UPDATE jinetes SET nombre = new_name WHERE nombre = old_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ── 1. Caballos duplicados en resultados_pdf ─────────────────────
UPDATE resultados_pdf SET caballo = 'America da Riviera' WHERE caballo = 'América Da Riviera';
UPDATE resultados_pdf SET caballo = 'Belen'              WHERE caballo = 'Belén';
UPDATE resultados_pdf SET caballo = 'D''Orion'           WHERE caballo = 'D''orion';
UPDATE resultados_pdf SET caballo = 'Fantastico'         WHERE caballo = 'Fantástico';

-- ── 2. Fernando Bedoya → Fernando Bedoya Alipaz ──────────────────
SELECT _rename_jinete('Fernando Bedoya', 'Fernando Bedoya Alipaz');

-- ── 3. Jinetes: primer apellido ─────────────────────────────────
SELECT _rename_jinete('Claudia Barriga Soliz',        'Claudia Barriga');
SELECT _rename_jinete('Evangelina Rico Toro Forti',   'Evangelina Rico Toro');
SELECT _rename_jinete('Isabela Arenales Salinas',     'Isabela Arenales');
SELECT _rename_jinete('Ismael Quiroga Obregón',       'Ismael Quiroga');
SELECT _rename_jinete('Lucas Cespedes Casal',         'Lucas Cespedes');
SELECT _rename_jinete('Lucas Cuellar Quiroga',        'Lucas Cuellar');
SELECT _rename_jinete('Margarita Lopez Román',        'Margarita Lopez');
SELECT _rename_jinete('Maria Rene Velez Espindola',   'Maria Rene Velez');
SELECT _rename_jinete('Miranda Céspedes Casal',       'Miranda Céspedes');
SELECT _rename_jinete('Thomas Céspedes Landivar',     'Thomas Céspedes');
SELECT _rename_jinete('Zoe Alvarez Vaca',             'Zoe Alvarez');

SELECT _rename_jinete('Andrea Victoria Galvan Sejas', 'Andrea Victoria Galvan');
SELECT _rename_jinete('Anialia Soljancic Aguilera',   'Anialia Soljancic');
SELECT _rename_jinete('Antonia Numberg Miserendino',  'Antonia Numberg');
SELECT _rename_jinete('Erlando Balcázar Añez',        'Erlando Balcázar');
SELECT _rename_jinete('Julieta Justiniano Ferra',     'Julieta Justiniano');
SELECT _rename_jinete('Luciana Angulo Daza',          'Luciana Angulo');
SELECT _rename_jinete('Luciana Dominguez Tavera',     'Luciana Dominguez');
SELECT _rename_jinete('Mariana Cortez Arenales',      'Mariana Cortez');
SELECT _rename_jinete('Mathias Cespedes Casal',       'Mathias Cespedes');
SELECT _rename_jinete('Micaela Navia Soleto',         'Micaela Navia');
SELECT _rename_jinete('Yassir Gutierrez Balcazar',    'Yassir Gutierrez');
SELECT _rename_jinete('Yoselyn Oliva Marco',          'Yoselyn Oliva');

-- ── 4. Dedupes de caballos 2025↔2026 ────────────────────────────
UPDATE resultados_pdf SET caballo = 'Pocahontas'            WHERE caballo = 'Pocahonta';
UPDATE resultados_pdf SET caballo = 'Sirius Bocelli'        WHERE caballo = 'Sirius Bocheli';
UPDATE resultados_pdf SET caballo = 'Fils de Diamant'       WHERE caballo = 'Fis De Diamant';
UPDATE resultados_pdf SET caballo = 'Carmeniere'            WHERE caballo IN ('Carmenier','Carmenere');

-- ── Cleanup ─────────────────────────────────────────────────────
DROP FUNCTION _rename_jinete(text, text);

SET LOCAL session_replication_role = DEFAULT;
COMMIT;
