// Consenso entre dos lecturas del mismo comprobante: ¿cuántas aprobaciones
// incorrectas quedan si el robot solo aprueba cuando DOS lecturas independientes
// coinciden en N° de operación y monto?
//   node consenso.mjs --lecturas lecturas_v23.json --verdad verdad.json [--reps 0,1]
// Idea (22-sep-2026): los errores residuales del OCR son de UN carácter (una S por
// un 5, un dígito de menos). Dos lecturas con temperatura 1 rara vez se equivocan
// igual; si no coinciden, la fila va a revisión. Cuesta una llamada más (~US$0,01).
import { readFileSync } from 'node:fs';
import { validarPago, normalizarNroOperacion } from '../../supabase/functions/_shared/validacion-pagos.ts';

const a = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((s) => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ')]; }));
const L = JSON.parse(readFileSync(a.lecturas, 'utf8'));
const V = JSON.parse(readFileSync(a.verdad, 'utf8'));
const [r0, r1] = (a.reps || '0,1').split(',').map(Number);

const verdadPorArchivo = new Map();
for (const e of V.entradas) verdadPorArchivo.set(e.archivo, e);

const glosaDe = (fila) => fila.tabla === 'afiliaciones' ? `Afiliacion ADESCRUZ ${fila.temporada}` : `${String(fila.concurso_id).split('-')[0]} CDS 2026`;
const stats = { archivos: 0, sinDosReps: 0, coinciden: 0, discrepan: 0, aprobadas: 0, incorrectas: 0, aRevision: 0, detalle: [] };

for (const [archivo, lec] of Object.entries(L.lecturas)) {
  const e = verdadPorArchivo.get(archivo);
  if (!e) continue;
  stats.archivos++;
  const x0 = lec.reps?.[r0]?.extracted, x1 = lec.reps?.[r1]?.extracted;
  if (!x0 || !x1) { stats.sinDosReps++; continue; }
  const n0 = normalizarNroOperacion(x0.nro_operacion), n1 = normalizarNroOperacion(x1.nro_operacion);
  const coinciden = n0 && n1 && n0 === n1 && Number(x0.monto) === Number(x1.monto);
  const fila = (e.filas || [])[0] || {};
  const expected = Number(fila.monto_esperado ?? e.comparacion?.[0]?.campos?.monto?.base ?? 0) || Number(e.verdad.monto) || 0;
  const dec = validarPago(x0, { expected, ventanaDesde: new Date('2025-01-01'), glosaEsperada: glosaDe(fila), exigirMonto: fila.tabla === 'afiliaciones' });
  if (!coinciden) { stats.discrepan++; stats.aRevision++; stats.detalle.push({ archivo, motivo: 'discrepan', n0, n1, m0: x0.monto, m1: x1.monto, verdad: e.verdad.nro_operacion }); continue; }
  stats.coinciden++;
  if (dec.estado === 'aprobada') {
    stats.aprobadas++;
    const mal = (e.verdad.nro_operacion && n0 !== e.verdad.nro_operacion) || (e.verdad.monto != null && Number(x0.monto) !== Number(e.verdad.monto));
    if (mal) { stats.incorrectas++; stats.detalle.push({ archivo, motivo: 'APROBADA INCORRECTA con consenso', n0, verdad: e.verdad.nro_operacion, m0: x0.monto, mv: e.verdad.monto }); }
  } else stats.aRevision++;
}
console.log(JSON.stringify({ ...stats, detalle: undefined }, null, 1));
for (const d of stats.detalle) console.log(d.motivo.padEnd(34), d.archivo.padEnd(48), 'n0', d.n0, '| n1', d.n1 ?? '', '| verdad', d.verdad, d.m0 !== undefined ? `| monto ${d.m0}/${d.m1 ?? d.mv}` : '');
