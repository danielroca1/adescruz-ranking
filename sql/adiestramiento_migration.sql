-- ══════════════════════════════════════════════════════════════
-- ADESCRUZ — Migración: campo adiestramiento en tabla ranking
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

ALTER TABLE ranking
  ADD COLUMN IF NOT EXISTS adiestramiento INTEGER DEFAULT 0;

COMMENT ON COLUMN ranking.adiestramiento IS
  'Conteo de participaciones en adiestramiento. Solo aplica a: '
  'Futuros Campeones, Escuela Menor, Escuela Mayor, Fomento Deportivo, '
  'Pre Infantil, Infantil A, Infantil B, Infantil C. '
  'No afecta el ranking departamental — solo se lleva el conteo.';
