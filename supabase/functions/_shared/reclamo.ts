// ─── Una sola lectura del comprobante a la vez (24-sep-2026) ────────────────
// El formulario y el webhook de la base llaman a la lectura casi juntos, y
// cualquiera con el id puede llamarla N veces más. Antes leían todas (2 llamadas
// a Claude cada una) y, en afiliaciones, se podían agregar caballos MIENTRAS el
// OCR leía: el monto esperado ya estaba calculado y la afiliación salía aprobada
// sin pagarlos.
//
// `reclamar_lectura_comprobante` (SQL, solo service_role) le da la lectura a UNA
// sola llamada: marca `lectura_iniciada_en`, y desde ese momento la base ya no
// acepta caballos para esa afiliación (privado.afiliacion_abierta_a_caballos).
// Las demás llamadas esperan a que la primera termine y devuelven lo guardado.
// La función libera el reclamo (NULL) al guardar el resultado; un reclamo de
// más de 3 minutos cuenta como abandonado.
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

export const ESPERA_MAX_MS = 50_000;
export const ESPERA_PASO_MS = 1_500;

export async function reclamarLectura(sb: SupabaseClient, tabla: 'inscripciones' | 'afiliaciones', id: string): Promise<boolean> {
  const { data, error } = await sb.rpc('reclamar_lectura_comprobante', { p_tabla: tabla, p_id: id });
  if (error) {
    console.error('reclamar_lectura_comprobante:', error.message);
    // Inscripciones: sin el reclamo (la base con un problema) se lee igual; un
    // pago no se queda sin verificar por un control extra. Afiliaciones NO: ahí
    // el reclamo es lo que cierra la carga de caballos, y leer sin él vuelve a
    // abrir «caballos agregados durante la lectura». Se sigue esperando y, si no
    // se consigue, queda pendiente para el admin.
    return tabla === 'inscripciones';
  }
  return data === true;
}

export const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
