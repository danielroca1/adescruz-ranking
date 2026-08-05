-- Canonicalización ranking_historico 2025 → nombres que ya existen en 2026
-- Generado 2026-04-19. Ejecutar en Supabase SQL Editor.
--
-- Total: 11 renames. Cada rename hace:
--   1. Si existe una fila con (temporada, nombre_nuevo, caballo, categoria) que colisiona
--      con una fila del nombre_viejo, se hace MERGE: suma puntos_total + participaciones
--      y luego DELETE de la fila vieja.
--   2. Las filas restantes (sin colisión) se renombran con UPDATE.
--
-- GRUPO A — 6 renames 2025 → canónico 2026 (Camila Kiara Mamani NO se renombra, decisión del usuario)
-- GRUPO B — 5 merges intra-2025

BEGIN;

-- Helper function (temporal, solo vive dentro de esta transacción)
CREATE OR REPLACE FUNCTION _rename_rh(old_name TEXT, new_name TEXT) RETURNS VOID AS $$
BEGIN
  -- Paso 1: merge de conflictos (sumar puntos y participaciones)
  UPDATE ranking_historico r
  SET puntos_total    = r.puntos_total    + s.puntos_total,
      participaciones = r.participaciones + s.participaciones,
      updated_at      = now()
  FROM ranking_historico s
  WHERE r.temporada        = s.temporada
    AND r.jinete           = new_name
    AND s.jinete           = old_name
    AND r.caballo          = s.caballo
    AND r.categoria_nombre = s.categoria_nombre;

  -- Paso 2: borrar filas viejas que colisionaron (ya mergeadas)
  DELETE FROM ranking_historico s
  WHERE s.jinete = old_name
    AND EXISTS (
      SELECT 1 FROM ranking_historico r
      WHERE r.temporada        = s.temporada
        AND r.jinete           = new_name
        AND r.caballo          = s.caballo
        AND r.categoria_nombre = s.categoria_nombre
    );

  -- Paso 3: renombrar filas restantes
  UPDATE ranking_historico SET jinete = new_name WHERE jinete = old_name;
END;
$$ LANGUAGE plpgsql;

-- GRUPO A: 2025 → canónico 2026
SELECT _rename_rh('Fharid Douglas Galvis',    'Fharid Galvis');
SELECT _rename_rh('Julieta Justiniano Ferra', 'Julieta Justiniano');
SELECT _rename_rh('Lucas Cuellar Quiroga',    'Lucas Cuellar');
SELECT _rename_rh('Luciana Angulo Daza',      'Luciana Angulo');
SELECT _rename_rh('Mathias Cespedes Casal',   'Mathias Cespedes');
SELECT _rename_rh('Yoselyn Oliva Marco',      'Yoselyn Oliva');

-- GRUPO B: merges intra-2025
SELECT _rename_rh('Erik Moron Osinaga',  'Erik Moron');
SELECT _rename_rh('Federico Suazo',      'Federico Zuazo');
SELECT _rename_rh('Jhanna Shugair',      'Jhanna Schugair');
SELECT _rename_rh('Paulina Paz Ortiz',   'Paulina Paz');
SELECT _rename_rh('Valentina Eguez',     'Valentina Egüez');

-- Limpiar helper
DROP FUNCTION _rename_rh(TEXT, TEXT);

COMMIT;

-- Verificación (ejecutar aparte después del COMMIT):
-- SELECT jinete FROM ranking_historico WHERE temporada = 2025 AND jinete IN (
--   'Fharid Douglas Galvis','Julieta Justiniano Ferra','Lucas Cuellar Quiroga',
--   'Luciana Angulo Daza','Mathias Cespedes Casal','Yoselyn Oliva Marco',
--   'Erik Moron Osinaga','Federico Suazo','Jhanna Shugair','Paulina Paz Ortiz','Valentina Eguez'
-- );
-- Debe devolver 0 filas.
