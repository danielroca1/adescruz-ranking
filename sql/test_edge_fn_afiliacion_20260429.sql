-- =====================================================================
-- Test Fase E · Escenario 2 (bypass form) — INSERT afiliación + caballo
-- y devolver el id para llamar a la Edge Function manualmente.
-- =====================================================================

WITH new_afil AS (
  INSERT INTO public.afiliaciones (
    temporada, nombre, email, celular, club, categoria_id,
    comprobante_url, estado, monto_esperado, total_pago
  )
  VALUES (
    2026,
    'Test Claude EdgeFn',
    'daniel.roca.s+test-claude-edgefn@gmail.com',
    '60000000',
    'Club Hípico Santa Cruz',
    10,                              -- Cuarta Categoría
    'afiliaciones/IMG_5917.PNG',
    'pendiente',
    710,
    710
  )
  RETURNING id, email
),
new_cab AS (
  INSERT INTO public.afiliacion_caballos (
    afiliacion_id, nombre_caballo, categoria_id, costo_aplicado
  )
  SELECT id, 'TestCaballoEdgeFn', 10, 210 FROM new_afil
  RETURNING afiliacion_id
)
SELECT
  a.id          AS afiliacion_id,
  a.email,
  '✅ Insert OK. Copiá el afiliacion_id para el siguiente paso.' AS nota
FROM new_afil a
JOIN new_cab  c ON c.afiliacion_id = a.id;
