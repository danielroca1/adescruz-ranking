// ============================================================================
// comparar.mjs — compara las lecturas contra la tabla de verdad (y contra la
// lectura vieja guardada en la base), campo por campo y por banco, clasifica
// los errores y simula la decisión del validador.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/ocr-harness/comparar.mjs \
//        --lecturas lecturas_actual.json [--verdad verdad_xiii_xiv.json] [--verdad-etiqueta "verdad (revisada)"] \
//        [--out informe_actual.md] [--rep 0]
//
// Sin --verdad, o si el archivo no existe, corre en MODO PROXY: compara la
// lectura nueva contra la lectura vieja de la base (`validacion_ocr.extracted`,
// prompt viejo sobre la imagen sin comprimir). Eso mide ACUERDO, no exactitud,
// y el informe lo dice.
//
// Esquema de la verdad (una entrada por archivo):
//   { archivo, filas?, verdad: { banco_origen, formato, tipo_transaccion, monto, moneda,
//     fecha_hora_impresa "YYYY-MM-DD HH:MM[:SS]" (Bolivia), nro_operacion, glosa,
//     cuenta_destino (con máscara), titular_destino, titular_origen, legible, confianza, dudas, extras? } }
// También acepta un objeto {clave: {archivo, ...campos al tope}} (el borrador
// del agente de la verdad) y {entradas|archivos|verdad: [...]}.
//
// Criterio que importa (auditoría 21-sep): CERO aprobaciones automáticas
// INCORRECTAS contra la verdad (monto, N° o cuenta distintos). Y Ganadero
// tiene que seguir en 0 errores.
//
// Privacidad: el informe nunca imprime el valor leído de una cuenta que no sea
// la de ADESCRUZ — solo la clasificación del error.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { rutas, leerJson, escribirJson, args, ahora } from './lib.mjs';
import { validarPago, normalizarNroOperacion, clasificarCuentaDestino, VALIDACION, parseFechaPago } from '../../supabase/functions/_shared/validacion-pagos.ts';

const CUENTA_ADESCRUZ = VALIDACION.cuenta_destino;
const CAMPOS = ['nro_operacion', 'monto', 'fecha_dia', 'fecha_hora', 'glosa', 'banco_origen', 'cuenta_destino', 'titular_destino', 'titular_origen', 'moneda'];
const CAMPOS_CLAVE = ['nro_operacion', 'monto', 'fecha_dia', 'fecha_hora', 'glosa', 'cuenta_destino'];   // los que deciden

// ─── normalizaciones ────────────────────────────────────────────────────────
export const normTexto = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const normNro = (s) => (s == null ? null : String(s).trim().toUpperCase().replace(/[\s\-.]/g, '') || null);
const soloDigitos = (s) => String(s ?? '').replace(/[^0-9]/g, '');
const vacio = (v) => v === null || v === undefined || String(v).trim() === '';

export function bancoCanon(s) {
  if (vacio(s)) return null;
  const n = normTexto(s);
  if (/ganadero/.test(n)) return 'Ganadero';
  if (/nacional|\bbnb\b|\bb n b\b/.test(n)) return 'BNB';
  if (/\bbcp\b|credito/.test(n)) return 'BCP';
  if (/mercantil|bmsc/.test(n)) return 'Mercantil';
  if (/economico/.test(n)) return 'Económico';
  if (/\bsol\b|bancosol/.test(n)) return 'BancoSol';
  if (/\bbisa\b/.test(n)) return 'BISA';
  if (/\bunion\b/.test(n)) return 'Unión';
  if (/\bfie\b/.test(n)) return 'FIE';
  if (/fassil/.test(n)) return 'Fassil';
  if (/prodem/.test(n)) return 'Prodem';
  if (/fortaleza/.test(n)) return 'Fortaleza';
  if (/tigo|yape|billetera/.test(n)) return 'Billetera';
  return 'Otro: ' + String(s).trim().slice(0, 30);
}

// Nombres: coincide si los tokens (≥3 letras) de uno están dentro del otro, o comparten ≥2.
export function nombreCoincide(a, b) {
  if (vacio(a) || vacio(b)) return false;
  const ta = normTexto(a).split(' ').filter((t) => t.length >= 3);
  const tb = normTexto(b).split(' ').filter((t) => t.length >= 3);
  if (!ta.length || !tb.length) return false;
  const [corto, largo] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const comunes = corto.filter((t) => largo.includes(t)).length;
  return comunes === corto.length || comunes >= 2;
}

// Cuentas: iguales, o compatibles con máscara (los dígitos visibles calzan en su posición).
// "Cuenta Corriente 200****154" → "200****154": el token más largo de dígitos y máscara.
export function tokenCuenta(s) {
  if (vacio(s)) return null;
  const toks = String(s).match(/[0-9*xX•·#][0-9*xX•·#\s.\-]*[0-9*xX•·#]|[0-9*xX•·#]/g) || [];
  const limpios = toks.map((t) => t.replace(/[\s.\-]/g, '')).filter((t) => /[0-9]/.test(t));
  if (!limpios.length) return null;
  return limpios.sort((x, y) => y.length - x.length)[0];
}
export function cuentasCompatibles(a, b) {
  if (vacio(a) || vacio(b)) return false;
  const na = tokenCuenta(a), nb = tokenCuenta(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const MASC = /[*xX•·#]/;
  const [m, plena] = MASC.test(na) && !MASC.test(nb) ? [na, nb] : (!MASC.test(na) && MASC.test(nb) ? [nb, na] : [null, null]);
  if (!m) {
    // las dos enmascaradas: mismo prefijo y sufijo visibles
    const p = (s) => s.match(/^[0-9]*/)[0], q = (s) => s.match(/[0-9]*$/)[0];
    return p(na) === p(nb) && q(na) === q(nb) && (p(na).length + q(na).length) >= 5;
  }
  const pre = m.match(/^[0-9]*/)[0], suf = m.match(/[0-9]*$/)[0];
  if (pre.length + suf.length < 5) return false;
  return plena.startsWith(pre) && plena.endsWith(suf) && plena.length >= pre.length + suf.length;
}

// Fecha ISO (UTC) → hora de Bolivia "YYYY-MM-DD HH:MM:SS".
export function isoABolivia(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return new Date(t - 4 * 3600e3).toISOString().replace('T', ' ').slice(0, 19);
}
function partesFecha(s) {
  const m = String(s ?? '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return { dia: `${m[1]}-${m[2]}-${m[3]}`, y: +m[1], mo: +m[2], d: +m[3], hhmm: m[4] ? `${m[4]}:${m[5]}` : null, h: m[4] ? +m[4] : null, mi: m[5] ? +m[5] : null };
}
// ¿El N° leído es OTRO código impreso en el comprobante (código de autorización, N° e-bisa, CI…)? Devuelve la clave de `extras` o null.
function otroCodigoDelComprobante(L, extras) {
  for (const [k, v] of Object.entries(extras || {})) {
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    if (normNro(v) === L) return k;
  }
  return null;
}
function editDist1(a, b) {   // ¿difieren en un solo carácter (sustitución, inserción o borrado)?
  if (a === b) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d === 1; }
  const [c, l] = a.length < b.length ? [a, b] : [b, a];
  for (let i = 0; i < l.length; i++) if (l.slice(0, i) + l.slice(i + 1) === c) return true;
  return false;
}

// ─── carga de la verdad en varias formas ─────────────────────────────────────
export function cargarVerdad(p) {
  if (!p || !fs.existsSync(p)) return null;
  const raw = leerJson(p);
  let lista = Array.isArray(raw) ? raw : (raw.entradas ?? raw.archivos ?? raw.verdad);
  if (!Array.isArray(lista) && raw && typeof raw === 'object') lista = Object.values(raw).filter((v) => v && typeof v === 'object' && v.archivo);
  if (!Array.isArray(lista)) throw new Error(`No entiendo el formato de la verdad en ${p}`);
  const mapa = new Map();
  for (const e of lista) {
    if (!e?.archivo) continue;
    const v = e.verdad ?? e;            // campos al tope (borrador) o bajo `verdad`
    mapa.set(e.archivo, {
      banco_origen: v.banco_origen ?? null, formato: v.formato ?? null, tipo_transaccion: v.tipo_transaccion ?? null,
      monto: v.monto == null ? null : Number(v.monto), moneda: v.moneda ?? null,
      fecha_hora_impresa: v.fecha_hora_impresa ?? v.fecha ?? null, nro_operacion: v.nro_operacion ?? null,
      glosa: v.glosa ?? null, cuenta_destino: v.cuenta_destino ?? null, titular_destino: v.titular_destino ?? null,
      titular_origen: v.titular_origen ?? null, banco_destino_impreso: v.banco_destino_impreso ?? v.banco_destino ?? null,
      legible: v.legible ?? null, confianza: v.confianza ?? null, dudas: v.dudas ?? null, extras: v.extras ?? {},
      filas: e.filas ?? null,
    });
  }
  return mapa;
}

// ─── comparación de una lectura contra una referencia (verdad o lectura vieja) ─
// Devuelve { campo: { ok: true|false|null, tipo, leido, esperado } }. ok=null → no comparable.
export function compararCampos(lec, ref, { esVerdad }) {
  const ex = lec.extracted ?? {};
  const R = {};
  const na = (leido, esperado, tipo = 'no_comparable') => ({ ok: null, tipo, leido, esperado });
  const okk = (leido, esperado) => ({ ok: true, tipo: null, leido, esperado });
  const err = (tipo, leido, esperado) => ({ ok: false, tipo, leido, esperado });

  // N° de operación — se compara el NORMALIZADO (lo que producción usaría).
  {
    const crudo = ex.nro_operacion ?? null;
    const leido = lec.nro_normalizado ?? normalizarNroOperacion(crudo);
    const esp = esVerdad ? ref.nro_operacion : normalizarNroOperacion(ref.extracted?.nro_operacion);
    const L = normNro(leido), E = normNro(esp);
    if (!E && !L) R.nro_operacion = na(leido, esp, crudo ? 'descartado_por_guard_sin_referencia' : 'ambos_nulos');
    else if (!E) R.nro_operacion = na(leido, esp, 'sin_referencia');
    else if (!L) {
      if (vacio(crudo)) R.nro_operacion = err('nro_no_leido', null, esp);
      else if (/\s/.test(String(crudo)) && ref.glosa && normTexto(crudo) === normTexto(ref.glosa)) R.nro_operacion = err('glosa_como_nro', crudo, esp);
      else if (/\s/.test(String(crudo))) R.nro_operacion = err('glosa_como_nro', crudo, esp);
      else if (soloDigitos(crudo) === CUENTA_ADESCRUZ) R.nro_operacion = err('cuenta_adescruz_como_nro', crudo, esp);
      else if (/\*/.test(String(crudo)) || String(crudo).length > 40) R.nro_operacion = err('campo_comprobante_bnb_como_nro', crudo, esp);
      else R.nro_operacion = err('nro_descartado_por_guard', crudo, esp);
    } else if (L === E) R.nro_operacion = okk(leido, esp);
    else if (/\*/.test(L)) R.nro_operacion = err('campo_comprobante_bnb_como_nro', leido, esp);
    else if (soloDigitos(L) === CUENTA_ADESCRUZ) R.nro_operacion = err('cuenta_adescruz_como_nro', leido, esp);
    else if (ref.extras?.bancarizacion_abono && normNro(ref.extras.bancarizacion_abono) === L) R.nro_operacion = err('nro_abono_en_vez_de_debito', leido, esp);
    else if (otroCodigoDelComprobante(L, ref.extras)) R.nro_operacion = err(`nro_otro_codigo_del_comprobante:${otroCodigoDelComprobante(L, ref.extras)}`, leido, esp);
    else if (E.includes(L) || L.includes(E)) R.nro_operacion = err('nro_cortado_o_incompleto', leido, esp);
    else if (editDist1(L, E)) R.nro_operacion = err('nro_un_caracter_distinto', leido, esp);
    else if (soloDigitos(L) === soloDigitos(E)) R.nro_operacion = err('nro_letra_mal_leida', leido, esp);
    else if (/^[0-9]+$/.test(L) && /[A-Z]/.test(E) && L.length === E.length) R.nro_operacion = err('nro_letra_como_digito', leido, esp);
    else R.nro_operacion = err('nro_distinto', leido, esp);
  }
  // Monto
  {
    const l = ex.monto == null ? null : Number(ex.monto);
    const e = esVerdad ? ref.monto : (ref.extracted?.monto == null ? null : Number(ref.extracted.monto));
    if (e == null && l == null) R.monto = na(l, e, 'ambos_nulos');
    else if (e == null) R.monto = na(l, e, 'sin_referencia');
    else if (l == null) R.monto = err('monto_no_leido', l, e);
    else if (Math.abs(l - e) < 0.005) R.monto = okk(l, e);
    else if (l === 0) R.monto = err('monto_cero', l, e);
    else R.monto = err('monto_distinto', l, e);
  }
  // Fecha (día y hora, en Bolivia)
  {
    // La lectura vieja guardada en la base también se compara por hora: la
    // corrección de fechas del 21-sep-2026 alcanzó al JSON de `validacion_ocr`
    // (verificado: 93 de 98 `extracted.fecha_pago` coinciden con la columna).
    const lBo = isoABolivia(lec.fecha_iso ?? parseFechaPago(ex.fecha_pago));
    const eBo = esVerdad ? ref.fecha_hora_impresa : isoABolivia(ref.extracted?.fecha_pago);
    const L = partesFecha(lBo), E = partesFecha(eBo);
    if (!E && !L) { R.fecha_dia = na(lBo, eBo, 'ambos_nulos'); R.fecha_hora = na(lBo, eBo, 'ambos_nulos'); }
    else if (!E) { R.fecha_dia = na(lBo, eBo, 'sin_referencia'); R.fecha_hora = na(lBo, eBo, 'sin_referencia'); }
    else if (!L) { R.fecha_dia = err('fecha_no_leida', lBo, eBo); R.fecha_hora = err('fecha_no_leida', lBo, eBo); }
    else {
      const mismaHora = L.hhmm && E.hhmm && L.hhmm === E.hhmm;
      if (L.dia === E.dia) R.fecha_dia = okk(lBo, eBo);
      else if (L.y === E.y && L.mo === E.d && L.d === E.mo) R.fecha_dia = err('fecha_dia_mes_invertidos', lBo, eBo);
      else if (Math.abs(new Date(L.dia) - new Date(E.dia)) === 86400e3 && (mismaHora || !E.hhmm)) R.fecha_dia = err('fecha_dia_corrido', lBo, eBo);
      else R.fecha_dia = err('fecha_distinta', lBo, eBo);
      if (!E.hhmm) R.fecha_hora = na(lBo, eBo, 'referencia_sin_hora');
      else if (!L.hhmm) R.fecha_hora = err('hora_no_leida', lBo, eBo);
      else if (mismaHora) R.fecha_hora = okk(lBo, eBo);
      else if (L.mi === E.mi && Math.abs(L.h - E.h) === 4) R.fecha_hora = err('hora_corrida_4h', lBo, eBo);
      else if (L.mi === E.mi && Math.abs(L.h - E.h) === 12) R.fecha_hora = err('hora_am_pm', lBo, eBo);
      else R.fecha_hora = err('hora_distinta', lBo, eBo);
    }
  }
  // Glosa — contenido, no igualdad (BCP antepone "BM QR").
  {
    const l = vacio(ex.glosa) ? null : String(ex.glosa).trim();
    const e = esVerdad ? (vacio(ref.glosa) ? null : String(ref.glosa).trim()) : (vacio(ref.extracted?.glosa) ? null : String(ref.extracted.glosa).trim());
    const nl = normTexto(l), ne = normTexto(e);
    if (!e && !l) R.glosa = na(l, e, 'ambos_nulos');
    else if (!e) R.glosa = na(l, e, 'sin_referencia');
    else if (!l) {
      const crudoNro = ex.nro_operacion;
      if (!vacio(crudoNro) && normTexto(crudoNro) === ne) R.glosa = err('glosa_fue_al_nro', l, e);
      else R.glosa = err('glosa_no_leida', l, e);
    } else if (nl === ne || (ne.length >= 3 && nl.includes(ne)) || (nl.length >= 3 && ne.includes(nl))) R.glosa = okk(l, e);
    else if (ref.extras?.nota_del_cliente && normTexto(ref.extras.nota_del_cliente) === nl) R.glosa = err('glosa_nota_del_cliente', l, e);
    else if (nombreCoincide(l, ref.titular_origen) || nombreCoincide(l, ref.titular_destino)) R.glosa = err('glosa_es_un_nombre', l, e);
    else R.glosa = err('glosa_distinta', l, e);
  }
  // Banco de origen
  {
    const l = bancoCanon(ex.banco_origen);
    const e = esVerdad ? bancoCanon(ref.banco_origen) : bancoCanon(ref.extracted?.banco_origen);
    const destino = esVerdad ? bancoCanon(ref.banco_destino_impreso) ?? 'BNB' : 'BNB';
    if (!e && !l) R.banco_origen = na(l, e, 'ambos_nulos');
    else if (!e) R.banco_origen = na(l, e, 'sin_referencia');
    else if (!l) R.banco_origen = err('banco_no_leido', l, e);
    else if (l === e) R.banco_origen = okk(l, e);
    else if (l === destino && e !== destino) R.banco_origen = err('banco_destino_como_origen', l, e);
    else R.banco_origen = err('banco_distinto', l, e);
  }
  // Cuenta destino — NUNCA se imprime el valor leído si no es la nuestra.
  {
    const l = vacio(ex.cuenta_destino) ? null : String(ex.cuenta_destino).trim();
    const e = esVerdad ? (vacio(ref.cuenta_destino) ? null : String(ref.cuenta_destino).trim()) : (vacio(ref.extracted?.cuenta_destino) ? null : String(ref.extracted.cuenta_destino).trim());
    const enmascarar = (v) => (v == null ? null : (cuentasCompatibles(v, CUENTA_ADESCRUZ) ? v : `«${String(v).length} caracteres, no es la de ADESCRUZ»`));
    const clasif = clasificarCuentaDestino(l, CUENTA_ADESCRUZ);
    if (!e && !l) R.cuenta_destino = na(null, null, 'ambos_nulos');
    else if (!e) R.cuenta_destino = na(enmascarar(l), null, 'sin_referencia');
    else if (!l) R.cuenta_destino = err('cuenta_no_leida', null, enmascarar(e));
    else if (cuentasCompatibles(l, e)) R.cuenta_destino = okk(enmascarar(l), enmascarar(e));
    else {
      const dl = soloDigitos(tokenCuenta(l) ?? l);
      let tipo = 'cuenta_distinta';
      const ciDestino = ref.extras?.ci_nit_destino ?? ref.extras?.nit_o_carnet_destino ?? null;
      if (ciDestino && dl === soloDigitos(ciDestino)) tipo = 'ci_como_cuenta';
      else if (/^[0-9]+$/.test(tokenCuenta(l) ?? '') && dl.length >= 5 && dl.length <= 8) tipo = 'ci_como_cuenta';
      else if (ref.extras?.cuenta_origen && soloDigitos(ref.extras.cuenta_origen) === dl) tipo = 'cuenta_origen_como_destino';
      else if (dl.length >= 9 && !cuentasCompatibles(l, CUENTA_ADESCRUZ) && cuentasCompatibles(e, CUENTA_ADESCRUZ)) tipo = 'cuenta_ajena_como_destino';
      R.cuenta_destino = { ...err(tipo, enmascarar(l), enmascarar(e)), clasificacion_prod: clasif };
    }
    R.cuenta_destino.clasificacion_prod = clasif;
  }
  // Titulares
  {
    const ld = vacio(ex.titular_destino) ? null : ex.titular_destino;
    const lo = vacio(ex.titular_origen) ? null : ex.titular_origen;
    const ed = esVerdad ? ref.titular_destino : ref.extracted?.titular_destino;
    const eo = esVerdad ? ref.titular_origen : ref.extracted?.titular_origen;
    if (vacio(ed) && !ld) R.titular_destino = na(ld, ed, 'ambos_nulos');
    else if (vacio(ed)) R.titular_destino = na(ld, ed, 'sin_referencia');
    else if (!ld) R.titular_destino = err('titular_dest_no_leido', ld, ed);
    else if (nombreCoincide(ld, ed) || (VALIDACION.titular_destino_re.test(ld) && VALIDACION.titular_destino_re.test(ed))) R.titular_destino = okk(ld, ed);
    else if (!vacio(eo) && nombreCoincide(ld, eo)) R.titular_destino = err('origen_destino_invertidos', ld, ed);
    else R.titular_destino = err('titular_dest_distinto', ld, ed);

    if (vacio(eo) && !lo) R.titular_origen = na(lo, eo, 'ambos_nulos');
    else if (vacio(eo)) R.titular_origen = na(lo, eo, esVerdad ? 'no_impreso_en_el_comprobante' : 'sin_referencia');
    else if (!lo) R.titular_origen = err('titular_orig_no_leido', lo, eo);
    else if (nombreCoincide(lo, eo)) R.titular_origen = okk(lo, eo);
    else if (!vacio(ed) && nombreCoincide(lo, ed)) R.titular_origen = err('origen_destino_invertidos', lo, eo);
    else R.titular_origen = err('titular_orig_distinto', lo, eo);
  }
  // Moneda
  {
    const l = vacio(ex.moneda) ? null : String(ex.moneda).toUpperCase();
    const e = esVerdad ? (vacio(ref.moneda) ? null : String(ref.moneda).toUpperCase()) : (vacio(ref.extracted?.moneda) ? null : String(ref.extracted.moneda).toUpperCase());
    if (!e) R.moneda = na(l, e, e === null && l === null ? 'ambos_nulos' : 'sin_referencia');
    else if (!l) R.moneda = err('moneda_no_leida', l, e);
    else if (l === e) R.moneda = okk(l, e);
    else R.moneda = err('moneda_distinta', l, e);
  }
  R._invertidos = ['banco_origen', 'cuenta_destino', 'titular_destino', 'titular_origen']
    .some((c) => /invertidos|destino_como_origen|origen_como_destino/.test(R[c]?.tipo || ''));
  return R;
}

// ─── simulación de la decisión ──────────────────────────────────────────────
function montoEsperadoFallback(fila) {
  if (fila.monto_esperado != null) return { expected: fila.monto_esperado, fuente: 'monto_esperado de la fila' };
  if (fila.tabla === 'afiliaciones') return { expected: 0, fuente: 'sin monto_esperado (afiliación) → 0' };
  const esFC = /futur|fut\.?\s*camp|^fc\b/i.test(fila.cat_concurso || '');
  const base = esFC ? 200 : 250;
  const d = String(fila.dias ?? '').toLowerCase();
  const ambos = d.includes('amb') || (d.includes('sab') && d.includes('dom'));
  return { expected: ambos ? base : Math.round(base * 0.5), fuente: 'tarifas por defecto (sin monto_esperado en la fila)' };
}
// El motivo de validarPago() trae el valor leído de la cuenta destino; en el
// JSON de detalle se guarda tapado (puede ser el CI del titular o una cuenta ajena).
const redactarMotivo = (m) => (m == null ? m : String(m).replace(/(Cuenta destino[^;]*?leyó ")([^"]*)(")/g, (_, a, v, c) => a + (cuentasCompatibles(v, CUENTA_ADESCRUZ) ? v : '«tapado»') + c));
export function simularDecision(extracted, fechaIso, fila, { glosaEsperada } = {}) {
  if (!extracted) return { estado: 'revision_manual', motivo: 'Error OCR (sin lectura)', expected: null, simulado: false };
  const { expected, fuente } = montoEsperadoFallback(fila);
  const ex = { ...extracted, fecha_pago: fechaIso ?? null };
  const ventanaDesde = new Date(new Date(fila.created_at).getTime() - VALIDACION.ventana_dias_atras * 86400e3);
  const v = validarPago(ex, {
    expected, ventanaDesde,
    glosaEsperada: glosaEsperada === undefined ? fila.glosa_esperada : glosaEsperada,
    cierreFecha: null,                            // en el set, ningún cierre real quedó sellado (cierre_ejecutado_en null)
    exigirMonto: fila.tabla === 'afiliaciones',
  });
  return { ...v, motivo: redactarMotivo(v.motivo), expected, fuente_expected: fuente, simulado: true };
}
// Una aprobación es INCORRECTA si lo que la sostuvo no coincide con la verdad.
export function aprobacionIncorrecta(cmp, verdad) {
  const motivos = [];
  if (verdad.legible === false) motivos.push('la verdad marca el comprobante como ilegible');
  if (cmp.monto.ok === false) motivos.push(`monto leído ${cmp.monto.leido} ≠ verdad ${cmp.monto.esperado}`);
  if (cmp.nro_operacion.ok === false) motivos.push(`N° leído ${cmp.nro_operacion.leido} ≠ verdad ${cmp.nro_operacion.esperado} (${cmp.nro_operacion.tipo})`);
  if (cmp.cuenta_destino.ok === false) motivos.push(`cuenta destino: ${cmp.cuenta_destino.tipo}`);
  if (verdad.cuenta_destino && !cuentasCompatibles(verdad.cuenta_destino, CUENTA_ADESCRUZ)) motivos.push('según la verdad el pago NO fue a la cuenta de ADESCRUZ');
  return motivos;
}

// ─── informe ────────────────────────────────────────────────────────────────
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '—');
const fila = (cells) => `| ${cells.join(' | ')} |`;
const tabla = (cab, filas) => [fila(cab), fila(cab.map(() => '---')), ...filas.map(fila)].join('\n');
const base = (p) => path.basename(p);
const esc = (s) => String(s ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');

async function main() {
  const a = args();
  const R = rutas();
  const set = leerJson(a.set || R.set);
  const lecturasPath = a.lecturas || path.join(R.dir, 'lecturas_actual.json');
  const lecturas = leerJson(lecturasPath);
  const repIdx = Number(a.rep || 0);
  const verdad = cargarVerdad(a.verdad);
  const modo = verdad ? 'verdad' : 'proxy';
  const etiquetaVerdad = a['verdad-etiqueta'] || (verdad ? `tabla de verdad (${base(a.verdad)})` : null);
  const nombre = lecturas.meta?.prompt?.nombre || 'lecturas';
  const salida = a.out || path.join(R.dir, `informe_${nombre}.md`);
  const salidaJson = salida.replace(/\.md$/, '') + '.json';

  const filasSet = new Map(set.archivos.map((x) => [x.archivo, x]));
  const porArchivo = [];
  for (const [archivo, L] of Object.entries(lecturas.lecturas)) {
    const x = filasSet.get(archivo);
    if (!x) continue;
    const rep = L.reps?.[repIdx] ?? L.reps?.find((r) => r.extracted) ?? null;
    const viejoFila = x.filas.find((f) => f.ocr_viejo?.extracted) ?? null;
    const viejo = viejoFila ? { extracted: viejoFila.ocr_viejo.extracted, validacion: viejoFila.ocr_viejo.validacion } : null;
    const V = verdad?.get(archivo) ?? null;
    const banco = bancoCanon(V?.banco_origen) ?? bancoCanon(viejo?.extracted?.banco_origen) ?? bancoCanon(rep?.extracted?.banco_origen) ?? bancoCanon(x.filas[0].banco_origen) ?? '— (sin banco)';

    const cmpVerdad = V && rep?.extracted ? compararCampos(rep, V, { esVerdad: true }) : null;
    const cmpViejo = viejo && rep?.extracted ? compararCampos(rep, viejo, { esVerdad: false }) : null;
    const cmpViejoVsVerdad = V && viejo ? compararCampos({ extracted: viejo.extracted, nro_normalizado: normalizarNroOperacion(viejo.extracted.nro_operacion), fecha_iso: viejo.extracted.fecha_pago }, V, { esVerdad: true }) : null;

    const decisiones = x.filas.map((f) => {
      const nueva = simularDecision(rep?.extracted ?? null, rep?.fecha_iso ?? null, f);
      const viejaRevalidada = viejo ? simularDecision(viejo.extracted, viejo.extracted.fecha_pago, f) : null;
      const viejaGuardada = f.ocr_viejo?.validacion?.estado ?? (f.ocr_viejo?.error ? 'revision_manual (Error OCR)' : null);
      const incorrecta = nueva.estado === 'aprobada' && cmpVerdad ? aprobacionIncorrecta(cmpVerdad, V) : [];
      const incorrectaVieja = viejaRevalidada?.estado === 'aprobada' && cmpViejoVsVerdad ? aprobacionIncorrecta(cmpViejoVsVerdad, V) : [];
      return { fila_id: f.id, tabla: f.tabla, nombre: f.nombre, concurso: f.concurso_id ?? `afiliación ${f.temporada}`, estado_real: f.estado,
        revisado_por_humano: f.revisado_por_humano, glosa_esperada: f.glosa_esperada, nueva, vieja_revalidada: viejaRevalidada, vieja_guardada: viejaGuardada,
        aprobacion_incorrecta: incorrecta, aprobacion_incorrecta_vieja: incorrectaVieja };
    });

    porArchivo.push({ archivo, banco, tiene_verdad: !!V, verdad_legible: V?.legible ?? null, verdad_confianza: V?.confianza ?? null, verdad_dudas: V?.dudas ?? null,
      lectura_ok: !!rep?.extracted, error_lectura: rep?.error ?? null, latencia_ms: rep?.latencia_ms ?? null, usage: rep?.usage ?? null,
      tiene_viejo: !!viejo, cmp_verdad: cmpVerdad, cmp_viejo: cmpViejo, cmp_viejo_vs_verdad: cmpViejoVsVerdad, decisiones });
  }

  // ── agregados ─────────────────────────────────────────────────────────────
  const agregar = (clave) => {
    const porCampo = Object.fromEntries(CAMPOS.map((c) => [c, { n: 0, ok: 0, err: 0, na: 0, tipos: {} }]));
    const porBanco = {};
    for (const p of porArchivo) {
      const cmp = p[clave];
      if (!cmp) continue;
      const B = (porBanco[p.banco] ||= { archivos: 0, con_error_clave: 0, campos: Object.fromEntries(CAMPOS.map((c) => [c, { ok: 0, n: 0 }])), invertidos: 0 });
      B.archivos++;
      if (cmp._invertidos) B.invertidos++;
      let errClave = false;
      for (const c of CAMPOS) {
        const r = cmp[c];
        if (r.ok === null) { porCampo[c].na++; continue; }
        porCampo[c].n++; B.campos[c].n++;
        if (r.ok) { porCampo[c].ok++; B.campos[c].ok++; } else {
          porCampo[c].err++;
          (porCampo[c].tipos[r.tipo] ||= []).push(base(p.archivo));
          if (CAMPOS_CLAVE.includes(c)) errClave = true;
        }
      }
      if (errClave) B.con_error_clave++;
    }
    return { porCampo, porBanco };
  };
  const agVerdad = modo === 'verdad' ? agregar('cmp_verdad') : null;
  const agViejo = agregar('cmp_viejo');
  const agViejoVsVerdad = modo === 'verdad' ? agregar('cmp_viejo_vs_verdad') : null;

  const todasDec = porArchivo.flatMap((p) => p.decisiones.map((d) => ({ ...d, archivo: p.archivo, banco: p.banco })));
  const cont = (xs, f) => xs.reduce((m, x) => { const k = f(x) ?? '—'; m[k] = (m[k] || 0) + 1; return m; }, {});
  const decNueva = cont(todasDec, (d) => d.nueva.estado);
  const decViejaRev = cont(todasDec.filter((d) => d.vieja_revalidada), (d) => d.vieja_revalidada.estado);
  const decViejaGuard = cont(todasDec, (d) => d.vieja_guardada);
  const incorrectas = todasDec.filter((d) => d.aprobacion_incorrecta.length);
  const incorrectasViejas = todasDec.filter((d) => d.aprobacion_incorrecta_vieja.length);
  const realHumano = todasDec.filter((d) => d.revisado_por_humano).length;

  // ── markdown ──────────────────────────────────────────────────────────────
  const L = [];
  L.push(`# Informe del harness OCR — prompt «${nombre}»`, '');
  L.push(`Generado ${ahora()} · lecturas: \`${base(lecturasPath)}\` (rep ${repIdx}) · set: ${set.resumen.archivos_unicos} archivos / ${set.resumen.filas} filas (${Object.entries(set.resumen.filas_por_concurso).map(([k, v]) => `${k}: ${v}`).join(', ')})`);
  L.push(`Modelo ${lecturas.meta?.modelo} · max_tokens ${lecturas.meta?.max_tokens} · temperature ${lecturas.meta?.temperature ?? 'por defecto'} · imágenes: ${lecturas.meta?.set === 'orig' ? 'ORIGINALES del bucket' : 'COMPRIMIDAS con las reglas de comprimir.js (PIL)'} · llamadas ${lecturas.meta?.llamadas} · tokens in/out ${lecturas.meta?.tokens?.input}/${lecturas.meta?.tokens?.output} · costo ≈ US$ ${lecturas.meta?.costo_usd_estimado} (precios a verificar) · errores de lectura ${lecturas.meta?.errores}`);
  L.push('');
  if (modo === 'verdad') {
    const conV = porArchivo.filter((p) => p.tiene_verdad).length;
    L.push(`**Modo: contra ${etiquetaVerdad}.** ${conV} de ${porArchivo.length} archivos tienen entrada en la verdad` + (conV < porArchivo.length ? ` (los otros ${porArchivo.length - conV} solo se comparan con la lectura vieja).` : '.'));
    const noLegibles = porArchivo.filter((p) => p.verdad_legible === false).length;
    const bajaConf = porArchivo.filter((p) => p.tiene_verdad && /baja|media/i.test(String(p.verdad_confianza))).length;
    L.push(`La verdad marca ${noLegibles} ilegible/s y ${bajaConf} con confianza media/baja (ver el detalle al final; lo dudoso de la verdad no cuenta como error del lector, cuenta como duda).`);
  } else {
    L.push(`**Modo PROXY: no había tabla de verdad** (\`--verdad\` no dado o inexistente). Se compara la lectura nueva contra la lectura VIEJA guardada en la base (\`validacion_ocr.extracted\`, prompt de entonces sobre la imagen SIN comprimir). Esto mide **acuerdo entre dos lecturas del mismo modelo**, no exactitud: si las dos se equivocan igual, acá sale «ok». Las «aprobaciones incorrectas» no se pueden calcular sin verdad.`);
  }
  L.push('');

  const tablaCampos = (ag, titulo) => {
    L.push(`## ${titulo}`, '');
    L.push(tabla(['Campo', 'Comparables', 'Aciertos', '%', 'Errores', 'No comparables'],
      CAMPOS.map((c) => { const r = ag.porCampo[c]; return [c, r.n, r.ok, pct(r.ok, r.n), r.err, r.na]; })));
    L.push('');
    L.push(`Errores por tipo (campo → tipo: cantidad, ejemplos):`, '');
    for (const c of CAMPOS) {
      const tipos = Object.entries(ag.porCampo[c].tipos).sort((x, y) => y[1].length - x[1].length);
      for (const [t, ejs] of tipos) L.push(`- **${c} → ${t}**: ${ejs.length}  _(${ejs.slice(0, 3).join(', ')}${ejs.length > 3 ? ', …' : ''})_`);
    }
    L.push('');
  };
  const tablaBancos = (ag, titulo) => {
    L.push(`## ${titulo}`, '');
    const bancos = Object.entries(ag.porBanco).sort((x, y) => y[1].archivos - x[1].archivos);
    L.push(tabla(['Banco', 'Archivos', 'Con algún error clave', ...CAMPOS_CLAVE, 'invertidos'],
      bancos.map(([b, r]) => [b, r.archivos, `${r.con_error_clave} (${pct(r.con_error_clave, r.archivos)})`, ...CAMPOS_CLAVE.map((c) => `${r.campos[c].ok}/${r.campos[c].n}`), r.invertidos])));
    L.push('', `_«Error clave» = falla en N°, monto, fecha (día u hora), glosa o cuenta destino. Celdas: aciertos/comparables._`, '');
  };

  if (agVerdad) { tablaCampos(agVerdad, 'Lectura nueva vs verdad — por campo'); tablaBancos(agVerdad, 'Lectura nueva vs verdad — por banco'); }
  if (agViejoVsVerdad) { tablaBancos(agViejoVsVerdad, 'Lectura VIEJA (base, sin comprimir) vs verdad — por banco (para ver si la nueva mejora o empeora)'); }
  tablaCampos(agViejo, modo === 'verdad' ? 'Acuerdo lectura nueva vs lectura vieja de la base (misma imagen, sin comprimir)' : 'Lectura nueva vs lectura vieja de la base (PROXY)');
  if (modo !== 'verdad') tablaBancos(agViejo, 'Desacuerdo por banco (PROXY: banco según la lectura vieja)');

  // ── decisión ──────────────────────────────────────────────────────────────
  L.push('## Simulación de la decisión (`validarPago` actual, por fila)', '');
  L.push(`Se corre el validador de HOY sobre cada lectura con \`expected\` = \`monto_esperado\` de la fila (${todasDec.filter((d) => d.nueva.fuente_expected?.startsWith('tarifas')).length} filas sin monto_esperado usaron tarifas por defecto) y la glosa esperada del concurso (afiliaciones: «Afiliacion ADESCRUZ <gestión>»; la ruta automática de producción usa la de site_config para todas). No se simula el anti-reúso por N° (necesita el estado de \`operaciones_consumidas\`) ni el chequeo de cierre (ningún cierre real quedó sellado en el set).`, '');
  L.push(tabla(['', 'aprobada', 'revision_manual', 'otros'], [
    ['**Lectura nueva** (este prompt, imágenes comprimidas)', decNueva.aprobada || 0, decNueva.revision_manual || 0, Object.entries(decNueva).filter(([k]) => !['aprobada', 'revision_manual'].includes(k)).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'],
    ['Lectura vieja, re-validada con el validador de hoy', decViejaRev.aprobada || 0, decViejaRev.revision_manual || 0, Object.entries(decViejaRev).filter(([k]) => !['aprobada', 'revision_manual'].includes(k)).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'],
    ['Decisión que quedó guardada en la base en su momento', decViejaGuard.aprobada || 0, decViejaGuard.revision_manual || 0, Object.entries(decViejaGuard).filter(([k]) => !['aprobada', 'revision_manual'].includes(k)).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'],
  ]));
  L.push('', `Filas del set que pasaron por una persona (\`revisado_por\`): **${realHumano} de ${todasDec.length}** (${pct(realHumano, todasDec.length)}). Meta operativa de la propuesta: bajar lo que pasa por Daniel del 47 % a ~15 %.`, '');
  if (modo === 'verdad') {
    L.push(`### 🔴 Aprobaciones automáticas INCORRECTAS según la verdad`, '');
    L.push(`Lectura nueva: **${incorrectas.length}** de ${decNueva.aprobada || 0} aprobadas. Lectura vieja re-validada: **${incorrectasViejas.length}** de ${decViejaRev.aprobada || 0}.`, '');
    for (const d of incorrectas) L.push(`- ${esc(base(d.archivo))} · ${esc(d.nombre)} (${d.concurso}) · ${d.aprobacion_incorrecta.join('; ')}`);
    for (const d of incorrectasViejas) L.push(`- _(vieja)_ ${esc(base(d.archivo))} · ${esc(d.nombre)} · ${d.aprobacion_incorrecta_vieja.join('; ')}`);
    L.push('');
  }
  // Motivos de revisión (qué frena las aprobaciones)
  const motivos = {};
  for (const d of todasDec) if (d.nueva.estado === 'revision_manual') for (const m of String(d.nueva.motivo || '').split('; ')) { const k = m.replace(/leyó ".*?"/g, 'leyó "…"').replace(/Bs [\d.]+/g, 'Bs …').replace(/\(fecha .*?\)/, '(fecha …)').replace(/esperaba que contenga ".*?"/, 'esperaba que contenga "…"').slice(0, 110); motivos[k] = (motivos[k] || 0) + 1; }
  L.push('### Por qué caen a revisión (lectura nueva; una fila puede tener varios motivos)', '');
  for (const [k, v] of Object.entries(motivos).sort((x, y) => y[1] - x[1])) L.push(`- ${v} × ${esc(k)}`);
  L.push('');

  // ── detalle por archivo ───────────────────────────────────────────────────
  const clave = modo === 'verdad' ? 'cmp_verdad' : 'cmp_viejo';
  const conErrores = porArchivo.filter((p) => !p.lectura_ok || (p[clave] && CAMPOS.some((c) => p[clave][c].ok === false)));
  L.push(`## Detalle por archivo (${conErrores.length} con alguna diferencia${modo === 'verdad' ? ' contra la verdad' : ' contra la lectura vieja'}; los demás leyeron todo igual)`, '');
  L.push(tabla(['Archivo', 'Banco', 'Decisión nueva', 'Diferencias (campo: tipo · leído → referencia)'],
    conErrores.map((p) => {
      const cmp = p[clave];
      const difs = !p.lectura_ok ? [`ERROR DE LECTURA: ${esc(p.error_lectura)}`]
        : CAMPOS.filter((c) => cmp[c].ok === false).map((c) => c === 'cuenta_destino'
          ? `${c}: ${cmp[c].tipo} (prod: ${cmp[c].clasificacion_prod})`
          : `${c}: ${cmp[c].tipo} · ${esc(cmp[c].leido)} → ${esc(cmp[c].esperado)}`);
      const dec = [...new Set(p.decisiones.map((d) => d.nueva.estado))].join('/');
      return [esc(base(p.archivo)).slice(0, 48), p.banco, dec, difs.join('<br>')];
    })));
  L.push('');
  if (modo === 'verdad') {
    const dudas = porArchivo.filter((p) => p.tiene_verdad && (p.verdad_legible === false || p.verdad_dudas));
    if (dudas.length) {
      L.push(`## Dudas que trae la verdad (${dudas.length})`, '');
      for (const p of dudas) L.push(`- ${esc(base(p.archivo))} · legible: ${p.verdad_legible ?? '?'} · confianza: ${p.verdad_confianza ?? '?'} · ${esc(String(p.verdad_dudas ?? '').slice(0, 220))}`);
      L.push('');
    }
  }
  L.push('## Qué NO mide este informe', '');
  L.push('- Una sola repetición por imagen no mide varianza (`temperature` por defecto = 1): dos corridas iguales pueden diferir. Para eso, `--rep 3`.');
  L.push('- Las imágenes comprimidas con PIL no son byte a byte las del navegador (otro remuestreo y otro encoder JPEG): mismo tamaño y calidad nominal.');
  L.push('- No simula el anti-reúso por N° ni el chequeo de cierre; no toca la base.');
  L.push('- La fecha de la lectura vieja se compara tal como quedó guardada: la corrección del 21-sep alcanzó al JSON (93 de 98 coinciden con la columna `fecha_pago`).');
  if (modo !== 'verdad') L.push('- Sin tabla de verdad, «acuerdo» no es «acierto».');

  fs.writeFileSync(salida, L.join('\n') + '\n');
  escribirJson(salidaJson, { generado: ahora(), modo, etiquetaVerdad, lecturas: base(lecturasPath), resumen: { decNueva, decViejaRev, decViejaGuard, incorrectas: incorrectas.length, incorrectas_viejas: incorrectasViejas.length, por_campo_verdad: agVerdad?.porCampo ?? null, por_banco_verdad: agVerdad?.porBanco ?? null, por_campo_viejo: agViejo.porCampo, por_banco_viejo: agViejo.porBanco }, archivos: porArchivo });
  console.log(`informe → ${salida}\ndetalle → ${salidaJson}`);
  console.log(`modo ${modo} · archivos ${porArchivo.length} · decisión nueva: ${JSON.stringify(decNueva)} · aprobaciones incorrectas: ${modo === 'verdad' ? incorrectas.length : 'n/a (sin verdad)'}`);
}

if (process.argv[1]?.endsWith('comparar.mjs')) {
  main().catch((e) => { console.error('ERROR comparar:', e.stack || e.message); process.exit(1); });
}
