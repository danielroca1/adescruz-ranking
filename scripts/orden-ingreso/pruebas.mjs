// Pruebas adversariales del orden de ingreso (7-oct-2026). Uso, desde la raíz del repo:
//   node scripts/orden-ingreso/pruebas.mjs
// Correrlas cada vez que se toque supabase/functions/_shared/orden-ingreso.js.
// La sección 4 usa inscripciones reales si existe ./inscripciones_reales.json al
// lado de este archivo (NO se sube al repo: tiene nombres de jinetes).
import * as OI from '../../supabase/functions/_shared/orden-ingreso.js';
import fs from 'node:fs';

let fallos = 0, chequeos = 0;
const falla = (msg, ctx) => { fallos++; if (fallos <= 25) console.log('  ✗', msg, ctx ? JSON.stringify(ctx).slice(0, 400) : ''); };
const ok = (cond, msg, ctx) => { chequeos++; if (!cond) falla(msg, ctx); };

// ── generador pseudoaleatorio con semilla (reproducible) ──
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = a => a[Math.floor(rnd() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const CATS_PRUEBA = {
  '0.90m': ['Pre Infantil', 'Fomento Deportivo', 'ABIERTA Fomento Deportivo'],
  '1.00m': ['Infantil C', '5ta Categoría', 'Caballos Novicios', 'ABIERTA 5ta Categoría'],
  '0.60m': ['Futuros Campeones', 'ABIERTA Futuros Campeones'],
};
let idc = 0;
const ins = (nombre, equino, cat, dias = 'ambos', minuto = idc, extra = {}) => ({
  id: 'id' + String(idc++).padStart(5, '0'), nombre, equino, cat_concurso: cat, dias, club: 'Club',
  created_at: `2026-10-0${1 + Math.floor(minuto / 1440) % 8}T${String(Math.floor(minuto / 60) % 24).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}:00+00`,
  estado: 'aprobada', ...extra });

function escenarioAzar() {
  const altura = pick(Object.keys(CATS_PRUEBA));
  const cats = CATS_PRUEBA[altura];
  const nJin = 2 + Math.floor(rnd() * 14);
  const caballos = Array.from({ length: nJin + 6 }, (_, i) => 'Caballo' + i);
  const out = [];
  let t = 0;
  for (let j = 0; j < nJin; j++) {
    const nombre = 'Jinete' + j;
    const nCab = rnd() < 0.55 ? 1 : (rnd() < 0.8 ? 2 : 3 + Math.floor(rnd() * 2));
    const cat = pick(cats);
    for (let c = 0; c < nCab; c++) {
      // a veces el mismo caballo lo corren dos jinetes (caballo compartido)
      const eq = rnd() < 0.12 ? pick(caballos.slice(0, 4)) : caballos[(j * 3 + c) % caballos.length] + '_' + j;
      // a veces uno de sus caballos va en ABIERTA y otro en la oficial (mixto)
      const catB = (nCab >= 2 && rnd() < 0.2) ? pick(cats) : cat;
      const dias = rnd() < 0.75 ? 'ambos' : pick(['sabado', 'domingo']);
      t += 1 + Math.floor(rnd() * 90);
      out.push(ins(nombre, eq, catB, dias, t));
    }
  }
  return out;
}

const bloques = filas => {
  const a = filas.filter(f => /^\s*abierta/i.test(f.cat)), o = filas.filter(f => !/^\s*abierta/i.test(f.cat));
  return [a, o];
};
const nrm = OI.norm;

// Chequea las reglas de un día de una prueba contra lo que entró.
function chequearPrueba(entrada, filas, ctx) {
  const ids = entrada.map(i => i.id).sort(), salen = filas.map(f => f.id).sort();
  ok(JSON.stringify(ids) === JSON.stringify(salen), 'se pierde o se repite un binomio', ctx);
  // ABIERTA primero
  const esAb = filas.map(f => /^\s*abierta/i.test(f.cat));
  const ultAb = esAb.lastIndexOf(true), primO = esAb.indexOf(false);
  ok(ultAb === -1 || primO === -1 || ultAb < primO, 'una ABIERTA quedó después de una oficial', ctx);
  ok(filas.every((f, i) => f.n === i + 1), 'numeración no correlativa', ctx);
}

function chequearExtremos(entrada, filas, ctx) {
  const porId = new Map(entrada.map(i => [i.id, i]));
  for (const bl of bloques(filas)) {
    const n = bl.length;
    const porJ = new Map();
    bl.forEach((f, p) => { const k = nrm(f.nombre); if (!porJ.has(k)) porJ.set(k, []); porJ.get(k).push(p); });
    const ult = k => entrada.filter(i => nrm(i.nombre) === k && bl.some(f => f.id === i.id)).map(i => i.created_at).sort().pop();
    const multi = [...porJ.keys()].filter(k => porJ.get(k).length >= 2)
      .sort((a, b) => (ult(b) > ult(a) ? 1 : ult(b) < ult(a) ? -1 : (a < b ? -1 : 1)));
    let k = 0;
    for (const jk of multi) {
      const i = k, j = n - 1 - k;
      if (j - i < OI.GAP_DURO) break;
      const ps = porJ.get(jk);
      ok(ps[0] === i && ps[ps.length - 1] === j, `jinete con varios caballos fuera de los extremos (esperado ${i + 1} y ${j + 1}, quedó ${ps.map(p => p + 1)})`, { ...ctx, jinete: jk });
      if (ps.length >= 3) {
        // El del medio tiene que estar lo más separado posible de sus otras pasadas:
        // ningún puesto que no sea de otro jinete fijo lo separaría más.
        const unTriple = [...porJ.values()].filter(v => v.length >= 3).length === 1;
        if (ps.length === 3 && unTriple && j - i >= 2 * OI.GAP_DURO) {
          const m = ps[1];
          ok(m - i >= OI.GAP_DURO && j - m >= OI.GAP_DURO, '3 caballos: el del medio quedó pegado a un extremo pudiendo no estarlo', { ...ctx, jinete: jk, ps });
          ok(Math.abs(m - (i + j) / 2) <= 1.5 || multi.length > 1, '3 caballos: el del medio no quedó en el medio', { ...ctx, jinete: jk, ps });
        }
      }
      k++;
    }
  }
}

function colisiones(filas, gap) {
  let c = 0; const pos = new Map();
  filas.forEach((f, p) => {
    for (const key of ['j:' + nrm(f.nombre), 'c:' + nrm(f.equino)]) {
      const q = pos.get(key); if (q !== undefined && p - q < gap) c++; pos.set(key, p);
    }
  });
  return c;
}

// ── 1. Concursos al azar ──
console.log('1) Concursos al azar');
let stats = { pruebas: 0, duroSab: 0, idealSab: 0, avisos: 0, mixtosDomDuro: 0 };
for (let caso = 0; caso < 3000; caso++) {
  const entrada = escenarioAzar();
  const r = OI.generarOrdenConcurso(entrada);
  const r2 = OI.generarOrdenConcurso(shuffle(entrada));
  ok(JSON.stringify(r) === JSON.stringify(r2), 'el resultado cambia según el orden en que llegan las filas', { caso });
  for (const dia of ['sab', 'dom']) {
    for (const p of r.dias[dia].pruebas) {
      stats.pruebas++;
      const ent = entrada.filter(i => OI.participaEnDia(i.dias, dia) && OI.CAT_TO_ALTURA[i.cat_concurso] === p.altura);
      chequearPrueba(ent, p.filas, { caso, dia, altura: p.altura });
      const sabP = r.dias.sab.pruebas.find(x => x.altura === p.altura);
      if (dia === 'sab' || !sabP) chequearExtremos(ent, p.filas, { caso, dia });
      if (dia === 'sab') { stats.duroSab += colisiones(p.filas, OI.GAP_DURO); stats.idealSab += colisiones(p.filas, OI.GAP_IDEAL); }
      stats.avisos += p.avisos.length;
      if (dia === 'dom' && sabP) {
        // El domingo es el sábado dado vuelta dentro de cada bloque (para los que
        // corren los dos días; se miran los binomios que aparecen una sola vez).
        const key = f => nrm(f.nombre) + '|' + nrm(f.equino) + '|' + nrm(f.cat);
        const cuenta = arr => arr.reduce((m, f) => m.set(key(f), (m.get(key(f)) || 0) + 1), new Map());
        const cS = cuenta(sabP.filas), cD = cuenta(p.filas);
        const posS = new Map(sabP.filas.map((f, i) => [key(f), i]));
        for (const bl of bloques(p.filas)) {
          const conocidos = bl.filter(f => cS.get(key(f)) === 1 && cD.get(key(f)) === 1).map(f => posS.get(key(f)));
          ok(conocidos.every((v, i) => i === 0 || v < conocidos[i - 1]), 'domingo: los que corren los dos días no quedaron invertidos', { caso, altura: p.altura });
          // El que corre solo el domingo va en la mitad de arriba de su bloque (o hay aviso).
          bl.forEach((f, q) => {
            if (cS.has(key(f))) return;
            stats.soloDom = (stats.soloDom || 0) + 1;
            const arriba = q <= Math.floor((bl.length - 1) / 2) + 1;
            if (!arriba) stats.soloDomAbajo = (stats.soloDomAbajo || 0) + 1;
            ok(arriba || p.avisos.some(a => a.includes(f.nombre)), 'domingo: el que corre solo el domingo quedó abajo sin aviso', { caso, altura: p.altura, q, len: bl.length });
          });
        }
      }
    }
  }
}
console.log('  pruebas revisadas:', stats.pruebas, '| sábados: pasadas a < 3 puestos:', stats.duroSab, '| a < 5:', stats.idealSab, '| avisos:', stats.avisos,
  '| solo domingo:', stats.soloDom, '(abajo, con aviso:', (stats.soloDomAbajo || 0) + ')');

// ── 2. Fuerza bruta: en casos chicos, ¿hay algún orden con menos choques? ──
console.log('2) Fuerza bruta en casos chicos');
function permutaciones(a) { if (a.length <= 1) return [a]; const out = []; a.forEach((x, i) => permutaciones(a.slice(0, i).concat(a.slice(i + 1))).forEach(p => out.push([x].concat(p)))); return out; }
let peores = 0, comparados = 0;
for (let caso = 0; caso < 400; caso++) {
  const entrada = escenarioAzar().slice(0, 4 + Math.floor(rnd() * 5)).map(i => ({ ...i, dias: 'sabado' }));
  const r = OI.generarOrdenConcurso(entrada);
  for (const p of r.dias.sab.pruebas) {
    const filas = p.filas;
    const [A, O] = bloques(filas);
    // Fijos = los extremos que puso el algoritmo (ya verificados arriba); se prueban
    // todas las formas de ordenar el resto dentro de cada bloque.
    const fijos = new Set();
    for (const bl of [A, O]) {
      const n = bl.length, porJ = new Map();
      bl.forEach((f, q) => { const k = nrm(f.nombre); (porJ.get(k) || porJ.set(k, []).get(k)).push(q); });
      // los que el algoritmo deja fijos: todas las pasadas del jinete que ocupa un par de extremos
      [...porJ.values()].filter(v => v.length >= 2).forEach(v => { if (v[v.length - 1] - v[0] >= OI.GAP_DURO && (v[0] + v[v.length - 1] === n - 1)) v.forEach(q => fijos.add(bl[q].id)); });
    }
    const mejorBloque = bl => {
      const libresPos = bl.map((f, q) => fijos.has(f.id) ? -1 : q).filter(q => q >= 0);
      const libres = libresPos.map(q => bl[q]);
      return permutaciones(libres).map(perm => { const b = bl.slice(); libresPos.forEach((q, x) => b[q] = perm[x]); return b; });
    };
    let mejorDuro = 1e9;
    for (const a of mejorBloque(A)) for (const o of mejorBloque(O)) mejorDuro = Math.min(mejorDuro, colisiones(a.concat(o), OI.GAP_DURO));
    comparados++;
    const nuestro = colisiones(filas, OI.GAP_DURO);
    if (nuestro > mejorDuro) { peores++; if (peores <= 5) console.log('  ✗ hay un orden con menos choques:', nuestro, 'vs', mejorDuro, filas.map(f => f.nombre + '/' + f.equino).join(' · ')); }
  }
}
ok(peores === 0, `en ${peores} de ${comparados} casos chicos había un orden con menos choques`);
console.log('  casos comparados:', comparados, '| peores que el óptimo:', peores);

// ── 3. Escenarios armados a propósito ──
console.log('3) Escenarios a propósito');
const filasDe = (r, dia, altura) => r.dias[dia].pruebas.find(p => p.altura === altura).filas;
const nombres = f => f.map(x => x.nombre + '/' + x.equino);

{ // 3a. El último en inscribirse va 1° y último; el anterior 2° y penúltimo
  idc = 0;
  const e = [ins('Ana', 'A1', 'Futuros Campeones', 'sabado', 10), ins('Ana', 'A2', 'Futuros Campeones', 'sabado', 11),
             ins('Beto', 'B1', 'Futuros Campeones', 'sabado', 50), ins('Beto', 'B2', 'Futuros Campeones', 'sabado', 51),
             ...Array.from({ length: 6 }, (_, i) => ins('Solo' + i, 'S' + i, 'Futuros Campeones', 'sabado', 20 + i))];
  const f = filasDe(OI.generarOrdenConcurso(e), 'sab', '0.60m');
  ok(f[0].nombre === 'Beto' && f[9].nombre === 'Beto' && f[1].nombre === 'Ana' && f[8].nombre === 'Ana', '3a: Beto (último inscrito) 1° y último, Ana 2° y penúltima', nombres(f));
}
{ // 3b. Tres caballos: primero, medio y último
  idc = 0;
  const e = [ins('Tri', 'T1', 'Pre Infantil', 'sabado', 1), ins('Tri', 'T2', 'Pre Infantil', 'sabado', 2), ins('Tri', 'T3', 'Pre Infantil', 'sabado', 3),
             ...Array.from({ length: 8 }, (_, i) => ins('Solo' + i, 'S' + i, i % 2 ? 'Pre Infantil' : 'Fomento Deportivo', 'sabado', 10 + i))];
  const f = filasDe(OI.generarOrdenConcurso(e), 'sab', '0.90m');
  const ps = f.map((x, i) => x.nombre === 'Tri' ? i : -1).filter(i => i >= 0);
  ok(ps[0] === 0 && ps[2] === 10 && Math.abs(ps[1] - 5) <= 1, '3b: 3 caballos en primero, medio y último', ps.map(p => p + 1));
}
{ // 3c. Mezcla de categorías «un poquito»: 6 y 6 → de a dos; nunca 4 seguidas
  idc = 0;
  const e = Array.from({ length: 12 }, (_, i) => ins('J' + i, 'C' + i, i < 6 ? 'Pre Infantil' : 'Fomento Deportivo', 'sabado', i));
  const f = filasDe(OI.generarOrdenConcurso(e), 'sab', '0.90m');
  const cats = f.map(x => x.cat[0]).join('');
  ok(!/(.)\1\1\1/.test(cats), '3c: 4 seguidas de la misma categoría', cats);
  ok(/PP|FF/.test(cats), '3c: tendría que mezclar de a 2-3, no alternar de a uno', cats);
  console.log('  3c 6+6:', cats);
  const e2 = Array.from({ length: 12 }, (_, i) => ins('K' + i, 'D' + i, i < 9 ? 'Fomento Deportivo' : 'Pre Infantil', 'sabado', i));
  console.log('  3c 9+3:', filasDe(OI.generarOrdenConcurso(e2), 'sab', '0.90m').map(x => x.cat[0]).join(''));
}
{ // 3d. Mixto: un caballo en ABIERTA y otro en la oficial → 4-5 en el medio, sábado y domingo
  idc = 0;
  const e = [ins('Mix', 'M1', 'ABIERTA Fomento Deportivo', 'ambos', 1), ins('Mix', 'M2', 'Fomento Deportivo', 'ambos', 2),
             ...Array.from({ length: 4 }, (_, i) => ins('Ab' + i, 'AB' + i, 'ABIERTA Fomento Deportivo', 'ambos', 10 + i)),
             ...Array.from({ length: 8 }, (_, i) => ins('Of' + i, 'OF' + i, i % 2 ? 'Fomento Deportivo' : 'Pre Infantil', 'ambos', 20 + i))];
  const r = OI.generarOrdenConcurso(e);
  for (const dia of ['sab', 'dom']) {
    const f = filasDe(r, dia, '0.90m');
    const ps = f.map((x, i) => x.nombre === 'Mix' ? i : -1).filter(i => i >= 0);
    ok(ps[1] - ps[0] >= OI.GAP_IDEAL, `3d: mixto con menos de 4 en el medio el ${dia}`, ps.map(p => p + 1));
    console.log(`  3d mixto ${dia}: puestos`, ps.map(p => p + 1).join(' y '), 'de', f.length);
  }
}
{ // 3e. Bloque de 4 con dos jinetes de 2 caballos: el de afuera en los extremos, el de adentro avisado
  idc = 0;
  const e = [ins('Uno', 'U1', 'Futuros Campeones', 'sabado', 1), ins('Uno', 'U2', 'Futuros Campeones', 'sabado', 2),
             ins('Dos', 'D1', 'Futuros Campeones', 'sabado', 3), ins('Dos', 'D2', 'Futuros Campeones', 'sabado', 4)];
  const r = OI.generarOrdenConcurso(e), p = r.dias.sab.pruebas[0];
  ok(p.filas[0].nombre === 'Dos' && p.filas[3].nombre === 'Dos', '3e: el último inscrito en los extremos', nombres(p.filas));
  ok(p.avisos.length > 0, '3e: tendría que avisar que Uno no entra separado', p.avisos);
  console.log('  3e:', nombres(p.filas).join(' · '), '| avisos:', p.avisos.join(' / '));
}
{ // 3f. Caballo compartido por dos jinetes: nunca seguidos
  idc = 0;
  const e = [ins('Hermana1', 'Bienvenido', 'Futuros Campeones', 'sabado', 1), ins('Hermana2', 'Bienvenido', 'Futuros Campeones', 'sabado', 2),
             ...Array.from({ length: 6 }, (_, i) => ins('S' + i, 'X' + i, 'Futuros Campeones', 'sabado', 10 + i))];
  const f = filasDe(OI.generarOrdenConcurso(e), 'sab', '0.60m');
  const ps = f.map((x, i) => x.equino === 'Bienvenido' ? i : -1).filter(i => i >= 0);
  ok(ps[1] - ps[0] >= OI.GAP_IDEAL, '3f: el caballo compartido quedó a menos de 5', ps);
}
{ // 3g. Domingo: el que fue 1° va último y al revés, también los de 2 caballos; el nuevo del domingo al final
  idc = 0;
  const e = [ins('Ana', 'A1', 'Futuros Campeones', 'ambos', 10), ins('Ana', 'A2', 'Futuros Campeones', 'ambos', 11),
             ...Array.from({ length: 6 }, (_, i) => ins('Solo' + i, 'S' + i, 'Futuros Campeones', 'ambos', 20 + i)),
             ins('Domingo', 'DD', 'Futuros Campeones', 'domingo', 99)];
  const r = OI.generarOrdenConcurso(e);
  const s = filasDe(r, 'sab', '0.60m'), d = filasDe(r, 'dom', '0.60m');
  const dSinNuevo = d.filter(x => x.nombre !== 'Domingo');
  ok(JSON.stringify(dSinNuevo.map(x => x.equino)) === JSON.stringify(s.map(x => x.equino).reverse()), '3g: domingo = sábado dado vuelta, también los de dos caballos', { sab: nombres(s), dom: nombres(d) });
  ok(d.findIndex(x => x.nombre === 'Domingo') <= 1, '3g: el que solo corre el domingo va primero o cerca de los primeros', nombres(d));
  console.log('  3g sáb:', nombres(s).join(' · ')); console.log('  3g dom:', nombres(d).join(' · '));
}
{ // 3h. Nombres con tildes/mayúsculas distintas = el mismo jinete
  idc = 0;
  const e = [ins('María José Pérez', 'Uno', 'Futuros Campeones', 'sabado', 1), ins('maria jose  perez', 'Dos', 'Futuros Campeones', 'sabado', 2),
             ...Array.from({ length: 5 }, (_, i) => ins('S' + i, 'X' + i, 'Futuros Campeones', 'sabado', 10 + i))];
  const f = filasDe(OI.generarOrdenConcurso(e), 'sab', '0.60m');
  ok(/mar/i.test(f[0].nombre) && /mar/i.test(f[f.length - 1].nombre), '3h: grafías distintas tendrían que contar como el mismo jinete', nombres(f));
}
{ // 3i. Rechazadas fuera, estado nulo adentro, categoría sin mapa aparte
  idc = 0;
  const e = [ins('Rech', 'R', 'Futuros Campeones', 'sabado', 1, { estado: 'rechazada' }), ins('Nulo', 'N', 'Futuros Campeones', 'sabado', 2, { estado: null }),
             ins('Rev', 'V', 'Futuros Campeones', 'sabado', 3, { estado: 'revision_manual' }), ins('Raro', 'Q', 'Categoría Inventada', 'sabado', 4)];
  const r = OI.generarOrdenConcurso(e);
  const f = filasDe(r, 'sab', '0.60m').map(x => x.nombre);
  ok(!f.includes('Rech') && f.includes('Nulo') && f.includes('Rev'), '3i: filtro permisivo', f);
  ok(r.dias.sab.sinClasificar.length === 1 && r.dias.sab.sinClasificar[0].nombre === 'Raro', '3i: la categoría sin mapa no se pierde', r.dias.sab.sinClasificar);
}
{ // 3j. Mismo binomio dos veces en la prueba (ABIERTA y oficial), el domingo también
  idc = 0;
  const e = [ins('Doble', 'Mismo', 'ABIERTA Fomento Deportivo', 'ambos', 1), ins('Doble', 'Mismo', 'Fomento Deportivo', 'ambos', 2),
             ...Array.from({ length: 7 }, (_, i) => ins('S' + i, 'X' + i, i < 3 ? 'ABIERTA Fomento Deportivo' : 'Pre Infantil', 'ambos', 10 + i))];
  const r = OI.generarOrdenConcurso(e);
  for (const dia of ['sab', 'dom']) {
    const f = filasDe(r, dia, '0.90m');
    ok(f.filter(x => x.nombre === 'Doble').length === 2, `3j: el binomio doble tiene que estar dos veces el ${dia}`, nombres(f));
    const ps = f.map((x, i) => x.nombre === 'Doble' ? i : -1).filter(i => i >= 0);
    ok(ps[1] - ps[0] >= OI.GAP_DURO, `3j: el binomio doble pegado el ${dia}`, ps);
  }
}
{ // 3k. Corre el sábado con dos caballos y el domingo con uno
  idc = 0;
  const e = [ins('Ana', 'A1', 'Futuros Campeones', 'ambos', 10), ins('Ana', 'A2', 'Futuros Campeones', 'sabado', 11),
             ...Array.from({ length: 5 }, (_, i) => ins('Solo' + i, 'S' + i, 'Futuros Campeones', 'ambos', 20 + i))];
  const r = OI.generarOrdenConcurso(e);
  ok(filasDe(r, 'dom', '0.60m').filter(x => x.nombre === 'Ana').length === 1, '3k: el domingo Ana corre una sola vez');
}
{ // 3l. Domingo: un jinete nuevo con 2 caballos (no corrió el sábado) no queda pegado
  idc = 0;
  const e = [...Array.from({ length: 6 }, (_, i) => ins('Solo' + i, 'S' + i, 'Futuros Campeones', 'ambos', 20 + i)),
             ins('Nuevo', 'N1', 'Futuros Campeones', 'domingo', 90), ins('Nuevo', 'N2', 'Futuros Campeones', 'domingo', 91)];
  const d = filasDe(OI.generarOrdenConcurso(e), 'dom', '0.60m');
  const ps = d.map((x, i) => x.nombre === 'Nuevo' ? i : -1).filter(i => i >= 0);
  ok(ps[1] - ps[0] >= OI.GAP_DURO, '3l: el nuevo del domingo con dos caballos quedó pegado', nombres(d));
}

// ── 4. Datos reales: XIII y XIV ──
console.log('4) Datos reales');
const archivoReales = new URL('./inscripciones_reales.json', import.meta.url);
const reales = fs.existsSync(archivoReales) ? JSON.parse(fs.readFileSync(archivoReales)) : [];
if (!reales.length) console.log('  (sin inscripciones_reales.json: se saltea)');
for (const cds of ['XIII-CDS-2026', 'XIV-CDS-2026', 'XVI-CDS-2026']) {
  const e = reales.filter(i => i.concurso_id === cds);
  const t0 = Date.now();
  const r = OI.generarOrdenConcurso(e);
  const ms = Date.now() - t0;
  let dur = 0, ideal = 0, av = 0;
  for (const dia of ['sab', 'dom']) for (const p of r.dias[dia].pruebas) {
    chequearPrueba(e.filter(i => OI.participaEnDia(i.dias, dia) && OI.entraAlOrden(i) && OI.CAT_TO_ALTURA[i.cat_concurso] === p.altura), p.filas, { cds, dia });
    dur += colisiones(p.filas, OI.GAP_DURO); ideal += colisiones(p.filas, OI.GAP_IDEAL); av += p.avisos.length;
  }
  console.log(`  ${cds}: ${r.inscripciones} inscripciones, ${ms} ms | a <3 puestos: ${dur} | a <5: ${ideal} | avisos: ${av}`);
}

console.log(`\n${chequeos} chequeos, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
