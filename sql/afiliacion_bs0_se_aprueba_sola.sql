-- Afiliación que BAJA a Bs 0 → queda «aprobada» sola (Daniel, 16-oct-2026: «hacé que se apruebe sola cuando baja a 0»).
-- Así «Pendientes» muestra solo lo que se debe. En el perfil y el estado de cuenta una afiliación de Bs 0 sin nada
-- pagado se sigue mostrando «SIN CARGO» (adescruz-site 1a50610).
--
-- Solo al ACTUALIZAR y solo cuando el monto BAJA de más de 0 a 0. No en el INSERT: la afiliación en línea nace en 0
-- (sanear_afiliacion_publica) y se le suman los caballos después; aprobarla al nacer la daría por pagada.
-- No toca las que tienen comprobante, algo pagado o N° de operación: esas las decide un humano.

create or replace function public.afiliacion_bs0_se_aprueba_sola()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.estado = 'pendiente'
     and coalesce(old.monto_esperado, 0) > 0
     and coalesce(new.monto_esperado, 0) = 0
     and nullif(btrim(new.comprobante_url), '') is null
     and coalesce(new.monto_pagado, 0) = 0
     and nullif(btrim(new.nro_operacion), '') is null then
    new.estado := 'aprobada';
    new.revisado_en := now();
    new.nota_admin := concat_ws(' · ', nullif(new.nota_admin, ''),
      'Aprobada sola el ' || to_char((now() at time zone 'America/La_Paz')::date, 'DD-MM-YYYY')
      || ': el monto bajó a Bs 0 (sin cargo)');
  end if;
  return new;
end
$$;

drop trigger if exists afiliacion_bs0_se_aprueba_sola on public.afiliaciones;
create trigger afiliacion_bs0_se_aprueba_sola
  before update of monto_esperado on public.afiliaciones
  for each row execute function public.afiliacion_bs0_se_aprueba_sola();
