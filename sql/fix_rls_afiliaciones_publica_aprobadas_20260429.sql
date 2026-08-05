-- =====================================================================
-- Permitir lectura pública (anon) de afiliaciones APROBADAS solamente.
-- Necesario para que el join `afiliacion_caballos !inner afiliaciones`
-- funcione desde el form de registro (anon).
--
-- Solo expone fields públicos: id, temporada, estado, nombre.
-- Los datos sensibles (email, celular, comprobante_url, monto, banco_origen,
-- etc.) NO quedan expuestos porque el cliente no los puede pedir si la policy
-- restringe — pero PostgREST devuelve toda la fila si hay SELECT genérico.
-- Solución: aplicamos la policy con SELECT condicionado a estado='aprobada'.
-- El cliente decide qué campos pide; los rows pendiente/rechazada/revisión
-- no se ven nunca.
-- =====================================================================

-- 1) Policy: anon puede leer solo afiliaciones aprobadas
DROP POLICY IF EXISTS "afiliaciones public read aprobadas" ON public.afiliaciones;
CREATE POLICY "afiliaciones public read aprobadas"
  ON public.afiliaciones
  FOR SELECT
  TO anon, authenticated
  USING (estado = 'aprobada');

-- 2) Column-level GRANT: anon solo puede leer 4 columnas no-sensibles
--    (datos privados como email, celular, comprobante_url, montos quedan ocultos)
REVOKE SELECT ON public.afiliaciones FROM anon;
GRANT  SELECT (id, temporada, estado, nombre) ON public.afiliaciones TO anon;
-- authenticated mantiene SELECT completo (RLS por row decide qué fila ve)

-- Verificación 1: policies
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'afiliaciones'
ORDER BY policyname;

-- Verificación 2: column privileges para anon
SELECT column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name='afiliaciones' AND grantee='anon'
ORDER BY column_name;
