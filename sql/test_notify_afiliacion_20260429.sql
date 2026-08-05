-- Insert afiliación de test para verificar el email de notify-afiliacion
WITH new_afil AS (
  INSERT INTO public.afiliaciones (
    temporada, nombre, email, celular, club, categoria_id,
    comprobante_url, estado, monto_esperado, total_pago
  )
  VALUES (
    2026,
    'Daniel Test Email',
    'daniel.roca.s@gmail.com',
    '60000000',
    'Club Hípico Santa Cruz',
    10,
    'afiliaciones/IMG_5917.PNG',
    'pendiente',
    710,
    710
  )
  RETURNING id, email, monto_esperado, temporada, nombre, club, celular, comprobante_url, estado, created_at, categoria_id
),
cab1 AS (
  INSERT INTO public.afiliacion_caballos (afiliacion_id, nombre_caballo, categoria_id, costo_aplicado)
  SELECT id, 'CaballoNormal', 10, 210 FROM new_afil RETURNING afiliacion_id
),
cab2 AS (
  INSERT INTO public.afiliacion_caballos (afiliacion_id, nombre_caballo, categoria_id, costo_aplicado)
  SELECT id, 'PonyFC', 1, 0 FROM new_afil RETURNING afiliacion_id
)
SELECT a.* FROM new_afil a;
