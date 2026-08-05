-- =====================================================================
-- Test Fase E · Anti-reuso cross-table — segunda afiliación apuntando
-- al mismo comprobante. La Edge Function debe rechazar por nro_operacion
-- ya existente en `afiliaciones`.
-- =====================================================================

WITH new_afil AS (
  INSERT INTO public.afiliaciones (
    temporada, nombre, email, celular, club, categoria_id,
    comprobante_url, estado, monto_esperado, total_pago
  )
  VALUES (
    2026,
    'Test Anti-Reuso',
    'daniel.roca.s+test-claude-antireuso@gmail.com',
    '60000001',
    'Club Hípico Santa Cruz',
    10,
    'afiliaciones/IMG_5917.PNG',   -- mismo archivo que la afil anterior
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
  SELECT id, 'CaballoAntiReuso', 10, 210 FROM new_afil
  RETURNING afiliacion_id
)
SELECT a.id AS afiliacion_id, a.email
FROM new_afil a JOIN new_cab c ON c.afiliacion_id = a.id;
