// ============================================================================
// _shared/orden-ingreso.js — el orden de ingreso de un CDS. UNA sola implementación.
//
// Lo usan el admin (vista previa y el orden OFICIAL que se guarda al cerrar a
// mano) y la Edge Function `cierre-inscripciones` (cierre automático). Hay dos
// copias IDÉNTICAS de este archivo, y tienen que seguir idénticas:
//   adescruz-ranking/supabase/functions/_shared/orden-ingreso.js   ← la original
//   adescruz-site/site/orden-ingreso.js                             ← la que carga el admin
// Si se cambia una, se copia la otra tal cual y se sube ORDEN_INGRESO_VERSION
// (queda guardada en cada orden oficial: así se sabe con qué reglas se armó).
//
// JavaScript puro, sin dependencias. El Excel recibe la librería (xlsx-js-style)
// por parámetro: en el navegador es la global XLSX, en Deno el paquete de npm.
//
// Reglas (definidas con Daniel; las de 6-oct-2026 reemplazan a las de agosto):
//   · Cada prueba (altura) va en dos bloques: ABIERTA primero, después la oficial.
//   · En cada bloque, el jinete con 2 caballos va en los extremos: el ÚLTIMO en
//     inscribirse va 1° y último, el anterior 2° y penúltimo, y así hacia adentro.
//     Con 3 o más caballos: primero, medio y último.
//   · El resto se acomoda en el medio mezclando las categorías «un poquito»
//     (dos de una, tres de otra), no en bloques rígidos.
//   · Mismo jinete o mismo caballo: nunca a menos de GAP_DURO puestos; mejor si
//     hay 4 o más en el medio (GAP_IDEAL). Vale también para el jinete que tiene
//     un caballo en ABIERTA y otro en la oficial, a través del borde de bloques.
//   · Domingo: el sábado dado vuelta dentro de cada bloque (ABIERTA sigue
//     abriendo). El que fue primero va último y viceversa, también los de dos
//     caballos. El que corre solo el domingo va del medio para arriba: primero o
//     cerca de los primeros (Daniel, 7-oct-2026).
//   · Se incluye todo lo que no está `rechazada` (el filtro permisivo): a la hora
//     del cierre puede haber pagos en revisión, y esa gente compite.
// ============================================================================

export const ORDEN_INGRESO_VERSION = '2026-10-07';

// Distancia en puestos entre dos pasadas del mismo jinete o del mismo caballo.
export const GAP_DURO = 3;    // mínimo: a menos de esto no le da el tiempo de cambiar de caballo
export const GAP_IDEAL = 5;   // Daniel, 6-oct-2026: «mejor si hay más de 3 caballos de separación»

export const CAT_TO_ALTURA = {
  'Futuros Campeones':          '0.60m',
  'ABIERTA Futuros Campeones':  '0.60m',
  'Escuela Menor':              '0.80m',
  'Escuela Mayor':              '0.80m',
  'ABIERTA Escuela Menor':      '0.80m',
  'ABIERTA Escuela Mayor':      '0.80m',
  'Pre Infantil':               '0.90m',
  'Fomento Deportivo':          '0.90m',
  'ABIERTA Fomento Deportivo':  '0.90m',
  'Infantil C':                 '1.00m',
  '5ta Categoría':              '1.00m',
  'Caballos Novicios':          '1.00m',
  'ABIERTA 5ta Categoría':      '1.00m',
  'Infantil B':                 '1.10m',
  '4ta Categoría':              '1.10m',
  'Caballos Jóvenes Serie 1':   '1.10m',
  'ABIERTA 4ta Categoría':      '1.10m',
  'Infantil A':                 '1.20m',
  '3ra Categoría':              '1.20m',
  'Caballos Jóvenes Serie 2':   '1.20m',
  'ABIERTA 3ra Categoría':      '1.20m',
  'Pre Juvenil':                '1.30m',
  '2da Categoría':              '1.30m',
  'ABIERTA 2da Categoría':      '1.30m',
  'Juveniles':                  '1.40m',
  '1ra Categoría':              '1.40m',
  'ABIERTA 1ra Categoría':      '1.40m',
};

export const PRUEBAS_CFG = [
  { altura: '0.60m', num: 'PRIMERA PRUEBA',  titulo: 'FUTUROS CAMPEONES' },
  { altura: '0.80m', num: 'SEGUNDA PRUEBA',  titulo: 'ESCUELA MAYOR/MENOR ABIERTA' },
  { altura: '0.90m', num: 'TERCERA PRUEBA',  titulo: 'PRE INFANTIL-FOMENTO DEPORTIVO-ABIERTA' },
  { altura: '1.00m', num: 'CUARTA PRUEBA',   titulo: 'INFANTILES C-CABALLOS NOVICIOS-QUINTA-ABIERTA' },
  { altura: '1.10m', num: 'QUINTA PRUEBA',   titulo: 'INFANTILES B-CABALLOS JOVENES SERIE I-CUARTA-ABIERTA' },
  { altura: '1.20m', num: 'SEXTA PRUEBA',    titulo: 'INFANTILES A-CABALLOS JOVENES SERIE II-TERCERA-ABIERTA' },
  { altura: '1.30m', num: 'SEPTIMA PRUEBA',  titulo: 'PRE JUVENIL-SEGUNDA-ABIERTA' },
  { altura: '1.40m', num: 'OCTAVA PRUEBA',   titulo: 'JUVENIL-PRIMERA-ABIERTA' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Mismo jinete / mismo caballo aunque cambien tildes, mayúsculas o espacios.
export function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

export function esAbierta(i) { return /^\s*abierta/i.test(i.cat_concurso || ''); }

export function participaEnDia(dias, dia) {
  const d = norm(dias);
  if (dia === 'sab') return d.includes('ambos') || d.includes('sab');
  if (dia === 'dom') return d.includes('ambos') || d.includes('dom');
  return true;
}

// Filtro permisivo: todo menos lo rechazado (un estado nulo también entra).
export function entraAlOrden(i) { return i.estado !== 'rechazada'; }

// Orden estable e independiente de cómo vengan las filas de la base: por hora de
// inscripción y, a igual hora, por id. Sin localeCompare (puede variar por entorno).
function cmpTxt(a, b) { a = String(a ?? ''); b = String(b ?? ''); return a < b ? -1 : a > b ? 1 : 0; }
function cmpInscripcion(a, b) { return cmpTxt(a.created_at, b.created_at) || cmpTxt(a.id, b.id); }

function anotar(i) {
  return Object.assign({}, i, {
    _j: norm(i.nombre), _c: norm(i.equino), _cat: i.cat_concurso || '', _ab: esAbierta(i),
    _dom: participaEnDia(i.dias, 'dom'),
    _k: norm(i.nombre) + '|' + norm(i.equino) + '|' + norm(i.cat_concurso),
  });
}

// ─── Mezcla de categorías en el medio del bloque ────────────────────────────
// «Podés poner dos de fomento deportivo, tres de preinfantil, ir mezclándolo un
// poquito, no necesariamente en bloques» (Daniel, 6-oct-2026). Cada categoría sale
// de a 1-3 seguidas, proporcional a cuántas tiene: con 6 y 6, de a dos; con 9 y 3,
// de a tres contra de a dos.
function mezclarCategorias(lista) {
  const porCat = new Map();
  lista.forEach(b => { if (!porCat.has(b._cat)) porCat.set(b._cat, []); porCat.get(b._cat).push(b); });
  if (porCat.size <= 1) return lista.slice();
  const cats = [...porCat.entries()].sort((a, b) => (b[1].length - a[1].length) || cmpTxt(a[0], b[0]));
  const min = Math.min(...cats.map(c => c[1].length));
  const tramos = cats.map(([, arr]) => ({ arr: arr.slice(), de: Math.max(1, Math.min(3, Math.round(2 * arr.length / min))) }));
  const out = [];
  while (tramos.some(t => t.arr.length)) {
    tramos.forEach(t => { for (let k = 0; k < t.de && t.arr.length; k++) out.push(t.arr.shift()); });
  }
  return out;
}

// ─── Armado inicial de un bloque (ABIERTA u oficial) ────────────────────────
// Devuelve los puestos del bloque y cuáles quedaron FIJOS (los extremos de los
// jinetes con varios caballos: el optimizador no los mueve).
function armarBloque(bloque, avisos) {
  const n = bloque.length;
  const slots = new Array(n).fill(null), fijo = new Array(n).fill(false);
  if (!n) return { slots, fijo };

  const porJinete = new Map();
  bloque.forEach(b => { if (!porJinete.has(b._j)) porJinete.set(b._j, []); porJinete.get(b._j).push(b); });
  const ultima = arr => arr.reduce((m, b) => (cmpTxt(b.created_at, m) > 0 ? b.created_at : m), '');
  // El último en inscribirse va 1° y último (Daniel, 6-oct-2026).
  const multi = [...porJinete.entries()].filter(([, arr]) => arr.length >= 2)
    .sort((a, b) => cmpTxt(ultima(b[1]), ultima(a[1])) || cmpTxt(a[0], b[0]));

  const resto = [];
  const medios = [];   // los del medio de los jinetes con 3 o más: se fijan después de los extremos
  let k = 0;
  for (const [, arr] of multi) {
    const i = k, j = n - 1 - k;
    if (j - i >= GAP_DURO) {
      slots[i] = arr[0]; slots[j] = arr[arr.length - 1];
      fijo[i] = fijo[j] = true;
      if (arr.length > 2) medios.push({ i, j, arr: arr.slice(1, -1) });
      k++;
    } else {
      // Ya no entra en los extremos sin quedar pegado: se separa lo que se pueda.
      resto.push(...arr);
      avisos.push(`${arr[0].nombre}: no entró en los extremos (el bloque es chico); quedó separado lo más posible`);
    }
  }
  // Con 3 o más caballos: primero, MEDIO y último. Cada uno del medio va al puesto
  // libre que más lo aleja de sus otras pasadas (los extremos y los del medio ya
  // puestos); a igual distancia, el más cercano al reparto parejo entre extremos.
  // Quedan fijos: si los movía el optimizador se iban hacia un extremo.
  for (const { i, j, arr } of medios) {
    const suyos = [i, j];
    arr.forEach((b, t) => {
      const meta = i + (t + 1) * (j - i) / (arr.length + 1);
      let elegido = -1, mejorSep = -1;
      for (let p = 0; p < n; p++) {
        if (slots[p]) continue;
        const sep = Math.min(...suyos.map(q => Math.abs(p - q)));
        if (sep > mejorSep || (sep === mejorSep && Math.abs(p - meta) < Math.abs(elegido - meta))) { elegido = p; mejorSep = sep; }
      }
      if (elegido >= 0) { slots[elegido] = b; fijo[elegido] = true; suyos.push(elegido); } else resto.push(b);
    });
  }
  porJinete.forEach(arr => { if (arr.length === 1) resto.push(arr[0]); });
  resto.sort(cmpInscripcion);
  const mezcla = mezclarCategorias(resto);
  let m = 0;
  for (let p = 0; p < n; p++) if (!slots[p]) slots[p] = mezcla[m++];
  return { slots, fijo };
}

// ─── Costo de un orden (menor es mejor, se compara en este orden) ───────────
//   1. pasadas del mismo jinete o caballo a menos de GAP_DURO
//   2. a menos de GAP_IDEAL
//   3. más de 3 seguidos de la misma categoría dentro de un bloque
//   4. la separación mínima entre repetidos (a maximizar)
//   5. la suma de separaciones (a maximizar)
// En 1 y 2 entran también las del DOMINGO del jinete que cruza el borde de
// bloques (un caballo en ABIERTA y otro en la oficial): al invertir dentro de cada
// bloque, sus dos pasadas se acercan o se alejan, así que se acomodan el sábado
// pensando en los dos días. Dentro de un bloque invertir no cambia las distancias.
function costo(o, nA) {
  const n = o.length, nO = n - nA;
  const invDom = p => (p < nA ? nA - 1 - p : nA + (nO - 1 - (p - nA)));
  let duro = 0, blando = 0, corridas = 0, minSep = 1e6, sumSep = 0;
  const pos = new Map();
  for (let p = 0; p < n; p++) {
    for (const key of ['j:' + o[p]._j, 'c:' + o[p]._c]) {
      const prev = pos.get(key);
      if (prev) {
        const q = prev[prev.length - 1], d = p - q;
        if (d < GAP_DURO) duro++; else if (d < GAP_IDEAL) blando++;
        if (d < minSep) minSep = d;
        sumSep += d;
        // El domingo, si las dos pasadas cruzan el borde y las dos corren ese día.
        if ((q < nA) !== (p < nA) && o[p]._dom && o[q]._dom) {
          const dd = Math.abs(invDom(p) - invDom(q));
          if (dd < GAP_DURO) duro++; else if (dd < GAP_IDEAL) blando++;
        }
        prev.push(p);
      } else pos.set(key, [p]);
    }
    if (p >= 3) {
      const mismoBloque = (p - 3 >= nA) || (p < nA);
      if (mismoBloque && o[p]._cat === o[p-1]._cat && o[p]._cat === o[p-2]._cat && o[p]._cat === o[p-3]._cat) corridas++;
    }
  }
  return [duro, blando, corridas, -minSep, -sumSep];
}

function mejor(a, b) {   // ¿a es estrictamente mejor que b?
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

// Busca el intercambio que más mejora, una y otra vez, hasta que ninguno mejora.
// Nunca cruza el borde ABIERTA / oficial ni toca un puesto fijo.
function optimizar(o, fijo, nA) {
  const n = o.length;
  const libres = [];
  for (let p = 0; p < n; p++) if (!fijo[p]) libres.push(p);
  for (let pase = 0; pase < 4 * n + 4; pase++) {
    const base = costo(o, nA);
    let elegido = null;
    for (let x = 0; x < libres.length; x++) {
      for (let y = x + 1; y < libres.length; y++) {
        const j = libres[x], k = libres[y];
        if ((j < nA) !== (k < nA)) continue;
        let t = o[j]; o[j] = o[k]; o[k] = t;
        const c = costo(o, nA);
        t = o[j]; o[j] = o[k]; o[k] = t;
        if (mejor(c, base) && (!elegido || mejor(c, elegido.c))) elegido = { c, j, k };
      }
    }
    if (!elegido) break;
    const t = o[elegido.j]; o[elegido.j] = o[elegido.k]; o[elegido.k] = t;
  }
  return o;
}

function avisosDeSeparacion(o) {
  const avisos = [], pos = new Map();
  o.forEach((b, p) => {
    for (const [key, quien] of [['j:' + b._j, b.nombre], ['c:' + b._c, 'el caballo ' + b.equino]]) {
      const q = pos.get(key);
      if (q !== undefined && p - q < GAP_DURO) avisos.push(`${quien}: dos pasadas a ${p - q} puesto(s) (puestos ${q + 1} y ${p + 1})`);
      pos.set(key, p);
    }
  });
  return avisos;
}

// ─── Una prueba, el sábado (o una prueba que solo corre el domingo) ─────────
export function ordenPrueba(binomios) {
  const avisos = [];
  const items = binomios.map(anotar).sort(cmpInscripcion);
  const A = armarBloque(items.filter(b => b._ab), avisos);
  const O = armarBloque(items.filter(b => !b._ab), avisos);
  const o = A.slots.concat(O.slots), fijo = A.fijo.concat(O.fijo);
  optimizar(o, fijo, A.slots.length);
  return { orden: o, avisos: avisos.concat(avisosDeSeparacion(o)) };
}

// ─── Una prueba, el domingo: el sábado dado vuelta dentro de cada bloque ────
export function ordenDomingo(binomiosDom, ordenSabado) {
  const avisos = [];
  const items = binomiosDom.map(anotar).sort(cmpInscripcion);
  // Cada binomio del domingo se busca por jinete + caballo + categoría (el mismo
  // binomio puede tener una inscripción por día). Si el mismo binomio aparece dos
  // veces en la misma categoría, la primera del domingo es la primera del sábado.
  const posSab = new Map();
  ordenSabado.forEach((b, p) => {
    const k = b._k || anotar(b)._k;
    if (!posSab.has(k)) posSab.set(k, []);
    posSab.get(k).push(p);
  });
  const usados = new Map();
  items.forEach(b => {
    const lista = posSab.get(b._k) || [], u = usados.get(b._k) || 0;
    b._posSab = u < lista.length ? lista[u] : null;
    usados.set(b._k, u + 1);
  });
  const bloque = arr => {
    const conocidos = arr.filter(b => b._posSab !== null).sort((a, b) => b._posSab - a._posSab);
    const nuevos = arr.filter(b => b._posSab === null);
    const o = conocidos.slice();
    // El que corre solo el domingo va del medio para arriba: «puede ser primero o
    // cerca a los primeros» (Daniel, 7-oct-2026). Se lo pone en el primer puesto
    // de la mitad de arriba donde no quede pegado a otra pasada suya o de su
    // caballo; si no hay, en el primero sin choque de todo el bloque.
    let siguiente = 0;
    for (const b of nuevos) {
      const mitad = Math.ceil((o.length + 1) / 2);
      let p = -1;
      for (let q = siguiente; q <= Math.min(mitad, o.length); q++) if (!choca(o, q, b)) { p = q; break; }
      if (p < 0) for (let q = 0; q <= o.length; q++) if (!choca(o, q, b)) { p = q; break; }
      if (p < 0) { p = siguiente; avisos.push(`${b.nombre} (${b.equino}) corre solo el domingo y no hay lugar sin quedar pegado`); }
      o.splice(p, 0, b);
      siguiente = p + 1;
    }
    // Se mira al final, con el bloque ya armado: ubicar a otro más arriba empuja hacia abajo a los anteriores.
    o.forEach((b, p) => {
      if (b._posSab === null && p > Math.floor((o.length - 1) / 2) + 1) {
        avisos.push(`${b.nombre} (${b.equino}) corre solo el domingo: no entró en la mitad de arriba sin quedar pegado, va en el puesto ${p + 1} del bloque`);
      }
    });
    return o;
  };
  const o = bloque(items.filter(b => b._ab)).concat(bloque(items.filter(b => !b._ab)));
  return { orden: o, avisos: avisos.concat(avisosDeSeparacion(o)) };
}

// ¿Insertar b en el puesto p lo deja a menos de GAP_DURO de otra pasada suya o de su caballo?
function choca(o, p, b) {
  for (let q = Math.max(0, p - GAP_DURO + 1); q < Math.min(o.length, p + GAP_DURO - 1); q++) {
    if (o[q]._j === b._j || o[q]._c === b._c) return true;
  }
  return false;
}

// ─── El concurso entero: sábado y domingo, prueba por prueba ────────────────
// `inscripciones`: filas de la tabla (id, nombre, equino, cat_concurso, dias, club,
// created_at, estado). Devuelve lo que se guarda como orden oficial.
export function generarOrdenConcurso(inscripciones) {
  const validas = (inscripciones || []).filter(entraAlOrden);
  const fila = (b, idx) => ({ n: idx + 1, id: b.id, nombre: b.nombre, equino: b.equino,
                              cat: b.cat_concurso, club: b.club || '' });
  const out = { version: ORDEN_INGRESO_VERSION, inscripciones: validas.length, dias: {} };
  const sab = {};
  for (const dia of ['sab', 'dom']) {
    const delDia = validas.filter(i => participaEnDia(i.dias, dia));
    const pruebas = [];
    for (const cfg of PRUEBAS_CFG) {
      const items = delDia.filter(i => CAT_TO_ALTURA[i.cat_concurso] === cfg.altura);
      if (!items.length) continue;
      const r = (dia === 'dom' && sab[cfg.altura] && sab[cfg.altura].length)
        ? ordenDomingo(items, sab[cfg.altura])
        : ordenPrueba(items);
      if (dia === 'sab') sab[cfg.altura] = r.orden;
      pruebas.push({ altura: cfg.altura, num: cfg.num, titulo: cfg.titulo,
                     filas: r.orden.map(fila), avisos: r.avisos });
    }
    // Una categoría que no está en el mapa no se pierde en silencio: va aparte.
    const sinClasificar = delDia.filter(i => !CAT_TO_ALTURA[i.cat_concurso]).sort(cmpInscripcion);
    out.dias[dia] = { pruebas, sinClasificar: sinClasificar.map(fila) };
  }
  return out;
}

// ─── El Excel de un día (formato de impresión que usan jueces y jinetes) ────
// `XLSX` es xlsx-js-style (SheetJS community IGNORA los estilos en silencio).
export function libroOrdenDia(XLSX, { titulo, subtitulo, dia }) {
  const NC = 5;
  const LINE = { style: 'thin', color: { rgb: 'FF000000' } };
  const BORDER = { top: LINE, bottom: LINE, left: LINE, right: LINE };
  const GREEN = { patternType: 'solid', fgColor: { rgb: 'FF1A4731' } };
  const YELLOW = { patternType: 'solid', fgColor: { rgb: 'FFFFF5CC' } };
  const secciones = dia.pruebas.map(p => ({ num: p.num, categoria: 'CATEGORIA ' + p.titulo, cba: true,
    filas: p.filas.map(f => [f.n, f.nombre, f.equino, f.cat, f.club]) }));
  if (dia.sinClasificar && dia.sinClasificar.length) {
    secciones.push({ num: 'SIN CLASIFICAR', categoria: 'CATEGORÍA QUE NO ESTÁ EN NINGUNA PRUEBA — REVISAR', cba: false,
      filas: dia.sinClasificar.map(f => [f.n, f.nombre, f.equino, f.cat, f.club]) });
  }
  const rows = [[titulo], [subtitulo || '']];
  const meta = [{ r: 0, t: 'titulo' }, { r: 1, t: 'sub' }];
  let r = 2;
  rows.push([]); r++;
  secciones.forEach(s => {
    rows.push([s.num]); meta.push({ r: r++, t: 'num' });
    rows.push([s.categoria]); meta.push({ r: r++, t: 'cat' });
    rows.push(['N°', 'JINETE/AMAZONA', 'EQUINO', 'CATEGORIA', 'CLUB']); meta.push({ r: r++, t: 'header' });
    if (s.cba) ['C', 'B', 'A'].forEach(l => { rows.push([l, '', '', '', '']); meta.push({ r: r++, t: 'cba' }); });
    s.filas.forEach(f => { rows.push(f); meta.push({ r: r++, t: 'data' }); });
    rows.push([]); rows.push([]); r += 2;
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 6 }, { wch: 32 }, { wch: 26 }, { wch: 28 }, { wch: 36 }];
  ws['!merges'] = [];
  ws['!rows'] = [];
  const cellAt = (rr, cc) => { const a = XLSX.utils.encode_cell({ r: rr, c: cc }); if (!ws[a]) ws[a] = { t: 's', v: '' }; return ws[a]; };
  const mergeFull = rr => ws['!merges'].push({ s: { r: rr, c: 0 }, e: { r: rr, c: NC - 1 } });
  meta.forEach(m => {
    if (m.t === 'titulo') {
      ws['!rows'][m.r] = { hpt: 26 }; mergeFull(m.r);
      cellAt(m.r, 0).s = { font: { bold: true, sz: 14, color: { rgb: 'FFFFFFFF' } }, fill: GREEN, alignment: { horizontal: 'center', vertical: 'center' } };
    } else if (m.t === 'sub') {
      ws['!rows'][m.r] = { hpt: 18 }; mergeFull(m.r);
      cellAt(m.r, 0).s = { font: { italic: true, sz: 10, color: { rgb: 'FF555555' } }, alignment: { horizontal: 'center', vertical: 'center' } };
    } else if (m.t === 'num' || m.t === 'cat') {
      ws['!rows'][m.r] = { hpt: 20 }; mergeFull(m.r);
      cellAt(m.r, 0).s = { font: { bold: true, sz: m.t === 'num' ? 12 : 11 }, alignment: { horizontal: 'center', vertical: 'center' } };
    } else if (m.t === 'header') {
      ws['!rows'][m.r] = { hpt: 20 };
      for (let c = 0; c < NC; c++) cellAt(m.r, c).s = { font: { bold: true, color: { rgb: 'FFFFFFFF' } }, fill: GREEN, alignment: { horizontal: 'center', vertical: 'center' }, border: BORDER };
    } else if (m.t === 'cba') {
      ws['!rows'][m.r] = { hpt: 20 };
      for (let c = 0; c < NC; c++) cellAt(m.r, c).s = { fill: YELLOW, font: { bold: c === 0 }, alignment: { horizontal: c === 0 ? 'center' : 'left', vertical: 'center' }, border: BORDER };
    } else if (m.t === 'data') {
      ws['!rows'][m.r] = { hpt: 19 };
      for (let c = 0; c < NC; c++) cellAt(m.r, c).s = { alignment: { horizontal: c === 0 ? 'center' : 'left', vertical: 'center' }, border: BORDER };
    }
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Orden de Ingreso');
  return wb;
}

export const DIA_TXT = { sab: 'SABADO', dom: 'DOMINGO' };

// Nombre del archivo de un día: Orden_Ingreso_XVI_CDS_SABADO_2026-10-10_v1.xlsx
export function nombreArchivo(cdsNombre, dia, fecha, version) {
  const base = String(cdsNombre || 'CDS').replace(/\s+/g, '_');
  return `Orden_Ingreso_${base}_${DIA_TXT[dia]}${fecha ? '_' + fecha : ''}${version ? '_v' + version : ''}.xlsx`;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Hora de Bolivia (UTC−4, sin horario de verano), sin depender de Intl.
export function horaBolivia(d) {
  const b = new Date(d.getTime() - 4 * 3600 * 1000), z = n => String(n).padStart(2, '0');
  return `${z(b.getUTCDate())}-${z(b.getUTCMonth() + 1)}-${b.getUTCFullYear()} ${z(b.getUTCHours())}:${z(b.getUTCMinutes())}`;
}

// ─── Leer de la base y guardar: lo mismo para el admin y para el cierre automático ───
// `sb` es un cliente de supabase-js: en el admin, el del administrador; en la Edge
// Function, el de la clave de servicio. Las dos rutas leen las mismas columnas con
// el mismo filtro, así que con la misma base dan el mismo orden.

export async function leerInscripciones(sb, concursoId) {
  const out = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb.from('inscripciones')
      .select('id, nombre, equino, cat_concurso, dias, club, created_at, estado')
      .eq('concurso_id', concursoId).order('id').range(desde, desde + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

export function contarAvisos(r) {
  return ['sab', 'dom'].reduce((s, d) => s + r.dias[d].sinClasificar.length
    + r.dias[d].pruebas.reduce((t, p) => t + p.avisos.length, 0), 0);
}

// Genera el orden con lo que hay HOY en la base, arma los Excel, los sube al bucket
// privado y guarda la versión siguiente. `campeonato`: { id, nombre, fecha_sab,
// fecha_dom, concurso_id }. `origen`: 'cierre_manual' | 'cierre_automatico' |
// 'nueva_version' | 'prueba' (las de prueba van en la carpeta prueba/ y se pueden borrar).
// Devuelve { version, archivos: {sab, dom}, orden, avisos, bytes: {sab, dom} }.
export async function guardarOrdenOficial({ sb, XLSX, campeonato, origen, ahora = new Date() }) {
  const concursoId = campeonato.concurso_id;
  const inscripciones = await leerInscripciones(sb, concursoId);
  const r = generarOrdenConcurso(inscripciones);
  const avisos = contarAvisos(r);
  const prefijo = origen === 'prueba' ? 'prueba/' : '';
  for (let intento = 0; intento < 3; intento++) {
    const { data: ult, error: e1 } = await sb.from('ordenes_ingreso').select('version')
      .eq('concurso_id', concursoId).order('version', { ascending: false }).limit(1);
    if (e1) throw e1;
    const version = ((ult && ult[0] && ult[0].version) || 0) + 1;
    const archivos = {}, bytes = {};
    let choque = false;
    for (const dia of ['sab', 'dom']) {
      const d = r.dias[dia];
      if (!d.pruebas.length && !d.sinClasificar.length) continue;
      const fecha = dia === 'sab' ? campeonato.fecha_sab : campeonato.fecha_dom;
      const wb = libroOrdenDia(XLSX, {
        titulo: `ORDEN DE INGRESO — ${campeonato.nombre} — ${DIA_TXT[dia]}`,
        subtitulo: `Orden oficial · versión ${version} · generado el ${horaBolivia(ahora)} (hora de Bolivia)`,
        dia: d,
      });
      const datos = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const ruta = `${prefijo}${concursoId}/v${version}/${nombreArchivo(campeonato.nombre, dia, fecha, version)}`;
      const { error: eu } = await sb.storage.from('ordenes-ingreso').upload(ruta, datos, { contentType: XLSX_MIME, upsert: false });
      if (eu) {
        // Otra llamada guardó esta misma versión al mismo tiempo: se pasa a la siguiente.
        if (/duplicate|already exists|409/i.test(eu.message || '') || eu.statusCode === '409') { choque = true; break; }
        throw eu;
      }
      archivos[dia] = ruta; bytes[dia] = datos;
    }
    if (choque) continue;
    const { error: ei } = await sb.from('ordenes_ingreso').insert({
      campeonato_id: campeonato.id, concurso_id: concursoId, version, origen,
      generado_en: ahora.toISOString(), algoritmo: ORDEN_INGRESO_VERSION,
      inscripciones: r.inscripciones, avisos, orden: r, archivos,
    });
    if (!ei) return { version, archivos, orden: r, avisos, bytes };
    if (ei.code !== '23505') throw ei;
  }
  throw new Error('No se pudo reservar un número de versión para el orden de ingreso');
}
