-- ============================================================
-- Backfill: eventos_externos temporada 2026
-- Fechas tomadas del array `externos` en calendario_2026.html (iCal).
-- Daniel revisará y corregirá discrepancias desde el admin.
-- Idempotente: ON CONFLICT (temporada, slug) DO UPDATE.
-- ============================================================

INSERT INTO public.eventos_externos
  (temporada, slug, tipo, nombre, numero_label, fecha_inicio, fecha_fin, sede, nota, estado)
VALUES
  -- Febrero
  (2026, 'cda1', 'CDA', 'CDA 1 — Adiestramiento', '1',
   '2026-02-21', '2026-02-22', 'CHSC, Santa Cruz de la Sierra', NULL, 'programado'),

  -- Marzo
  (2026, 'equifun', 'FEI', 'EquiFun FEI 2026', NULL,
   '2026-03-05', '2026-03-06', NULL, NULL, 'programado'),
  (2026, 'cda2', 'CDA', 'CDA 2 — Adiestramiento', '2',
   '2026-03-21', '2026-03-22', 'Alhambra, Santa Cruz de la Sierra', NULL, 'programado'),

  -- Abril
  (2026, 'cda3', 'CDA', 'CDA 3 — Adiestramiento', '3',
   '2026-04-18', '2026-04-19', 'CHLQ, Santa Cruz de la Sierra', NULL, 'programado'),

  -- Mayo
  (2026, 'fei1', 'FEI', 'FEI 1 — ADESCRUZ 2026', '1',
   '2026-05-17', '2026-05-18', 'CHSC, Santa Cruz de la Sierra', NULL, 'programado'),
  (2026, 'cda4', 'CDA', 'CDA 4 — Adiestramiento', '4',
   '2026-05-23', '2026-05-24', 'SCIS, Santa Cruz de la Sierra', NULL, 'programado'),
  (2026, 'fei2', 'FEI', 'FEI 2 — ADESCRUZ 2026', '2',
   '2026-05-31', '2026-06-01', 'CHSC, Santa Cruz de la Sierra', NULL, 'programado'),

  -- Julio
  (2026, 'cda5', 'CDA', 'CDA 5 — Copa Federación de Adiestramiento', '5',
   '2026-07-04', '2026-07-05', 'Amandari, Santa Cruz de la Sierra', NULL, 'programado'),

  -- Agosto
  (2026, 'fei3', 'FEI', 'FEI 3 + Dressage — ADESCRUZ 2026', '3',
   '2026-08-08', '2026-08-10', NULL, NULL, 'programado'),
  (2026, 'cda6', 'CDA', 'CDA 6 — Adiestramiento', '6',
   '2026-08-29', '2026-08-30', 'CHSC, Santa Cruz de la Sierra', NULL, 'programado'),

  -- Septiembre
  (2026, 'copa', 'COPA', 'Copa Bolivia 2026', NULL,
   '2026-09-06', '2026-09-07', 'CHSC, Santa Cruz de la Sierra', NULL, 'programado'),
  (2026, 'cda7', 'CDA', 'CDA 7 — Adiestramiento', '7',
   '2026-09-12', '2026-09-13', 'Alhambra, Santa Cruz de la Sierra', NULL, 'programado'),
  (2026, 'odessur', 'INTERNACIONAL', 'Juegos ODESSUR 2026', NULL,
   '2026-09-19', '2026-09-22', 'Argentina', 'Coincide con XIV CDS', 'programado'),

  -- Octubre
  (2026, 'sudamericano', 'INTERNACIONAL', 'Sudamericano Infanto Juvenil 2026', NULL,
   '2026-10-15', '2026-10-17', 'Santiago de Chile, Chile', NULL, 'programado'),
  (2026, 'cda8', 'CDA', 'CDA 8 — Adiestramiento', '8',
   '2026-10-17', '2026-10-18', 'CHSC, Santa Cruz de la Sierra', 'Organiza ADESCRUZ', 'programado'),
  (2026, 'nacional-adiest', 'NACIONAL', 'Campeonato Nacional Adiestramiento 2026', NULL,
   '2026-10-24', '2026-10-27', 'Cochabamba, Bolivia', NULL, 'programado'),
  (2026, 'nacional-salto', 'NACIONAL', 'Campeonato Nacional Salto 2026', NULL,
   '2026-10-29', '2026-11-01', 'Cochabamba, Bolivia', NULL, 'programado')

ON CONFLICT (temporada, slug) DO UPDATE
SET
  tipo          = EXCLUDED.tipo,
  nombre        = EXCLUDED.nombre,
  numero_label  = EXCLUDED.numero_label,
  fecha_inicio  = EXCLUDED.fecha_inicio,
  fecha_fin     = EXCLUDED.fecha_fin,
  sede          = EXCLUDED.sede,
  nota          = EXCLUDED.nota,
  estado        = EXCLUDED.estado;

-- Verificación
SELECT slug, tipo, nombre, fecha_inicio, fecha_fin, sede
FROM public.eventos_externos
WHERE temporada = 2026
ORDER BY fecha_inicio;
