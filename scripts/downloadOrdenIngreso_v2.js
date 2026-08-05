// ═══════════════════════════════════════════════════════════════════════════
// downloadOrdenIngreso — v2 (2026-04-19)
// Reemplaza la función en admin.html líneas ~2617–2713.
//
// Cambios respecto a v1:
//  • Pregunta "¿Sábado o Domingo?" al ejecutar
//  • Agrupa por ALTURA (no por categoría) — 8 hojas máximo
//  • Orden SAB = normal, DOM = invertido (último del sábado = primero del domingo)
//  • Filtra por día: solo inscritos al día que se está generando
//  • 7 filas vacías (A–G) arriba de cada hoja para inscripciones último momento
//  • Columnas: N° | JINETE | CABALLO | CATEGORIA | S | D | TOTAL | PUESTO
//  • Pre-pobla jinete/caballo/categoría — jurado solo completa S/D/TOTAL/PUESTO
// ═══════════════════════════════════════════════════════════════════════════

// Mapeo categoría (de formulario de inscripción) → altura
const CAT_TO_ALTURA = {
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

// Orden de las pruebas por altura
const PRUEBAS = [
  { altura: '0.60m', num: 'PRIMERA PRUEBA',  titulo: 'FUTUROS CAMPEONES' },
  { altura: '0.80m', num: 'SEGUNDA PRUEBA',  titulo: 'ESCUELA MAYOR/MENOR ABIERTA' },
  { altura: '0.90m', num: 'TERCERA PRUEBA',  titulo: 'PRE INFANTIL-FOMENTO DEPORTIVO-ABIERTA' },
  { altura: '1.00m', num: 'CUARTA PRUEBA',   titulo: 'INFANTILES C-CABALLOS NOVICIOS-QUINTA-ABIERTA' },
  { altura: '1.10m', num: 'QUINTA PRUEBA',   titulo: 'INFANTILES B-CABALLOS JOVENES SERIE I-CUARTA-ABIERTA' },
  { altura: '1.20m', num: 'SEXTA PRUEBA',    titulo: 'INFANTILES A-CABALLOS JOVENES SERIE II-TERCERA-ABIERTA' },
  { altura: '1.30m', num: 'SEPTIMA PRUEBA',  titulo: 'PRE JUVENIL-SEGUNDA-ABIERTA' },
  { altura: '1.40m', num: 'OCTAVA PRUEBA',   titulo: 'JUVENIL-PRIMERA-ABIERTA' },
];

// Dado el campo "dias" del formulario, ¿el binomio participa del día indicado?
function participaEnDia(diasField, diaTarget) {
  const d = String(diasField||'').toLowerCase();
  if (diaTarget === 'sab') return d.includes('ambos') || d.includes('sab') || d === 'solo sábado' || d === 'solo sabado';
  if (diaTarget === 'dom') return d.includes('ambos') || d.includes('dom') || d === 'solo domingo';
  return true;
}

async function downloadOrdenIngreso() {
  try {
    // 1. Preguntar al usuario qué día generar
    const diaLabel = prompt('¿Para qué día querés generar el orden de ingreso?\n\nEscribí: SAB  o  DOM', 'SAB');
    if (!diaLabel) return;
    const dia = diaLabel.trim().toLowerCase().startsWith('d') ? 'dom' : 'sab';
    const diaPretty = dia === 'dom' ? 'DOMINGO' : 'SABADO';

    toast('Generando planilla...');

    // 2. Fetch inscripciones
    const { data: inscripciones, error } = await db
      .from('inscripciones')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) { toast('Error: ' + error.message); return; }
    if (!inscripciones || inscripciones.length === 0) { toast('No hay inscripciones'); return; }

    // 3. Filtrar por día (excluyendo los que no participan ese día)
    const delDia = inscripciones.filter(i => participaEnDia(i.dias, dia));
    if (delDia.length === 0) { toast(`No hay inscripciones para ${diaPretty}`); return; }

    // 4. Agrupar por altura
    const porAltura = {};
    delDia.forEach(i => {
      const altura = CAT_TO_ALTURA[i.cat_concurso] || 'Sin clasificar';
      if (!porAltura[altura]) porAltura[altura] = [];
      porAltura[altura].push(i);
    });

    // 5. CDS context
    const cdsTitle = document.getElementById('insc-cds-title').textContent || 'CDS';

    // 6. Construir workbook
    const wb = XLSX.utils.book_new();

    PRUEBAS.forEach(prueba => {
      const items = porAltura[prueba.altura] || [];
      // Si domingo, invertir orden
      const ordered = dia === 'dom' ? [...items].reverse() : items;

      // Header rows
      const wsData = [
        [`ORDEN DE INGRESO — ${cdsTitle} — ${diaPretty}`],
        [prueba.num],
        [prueba.titulo],
        [],
        ['N°', 'JINETE/AMAZONA', 'CABALLO', 'CATEGORIA', 'S', 'D', 'TOTAL', 'PUESTO'],
      ];

      // 7 filas vacías A–G
      ['A','B','C','D','E','F','G'].forEach(letra => {
        wsData.push([letra, '', '', '', '', '', '', '']);
      });

      // Filas pobladas
      ordered.forEach((it, idx) => {
        wsData.push([
          idx + 1,
          it.nombre,
          it.equino,
          it.cat_concurso,
          '', '', '', ''
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Estilo: título grande (fila 1)
      const titleRef = 'A1';
      if (ws[titleRef]) ws[titleRef].s = {
        font: { bold: true, sz: 14, color: { rgb: 'FFFFFFFF' } },
        fill: { fgColor: { rgb: 'FF1a4731' } },
        alignment: { horizontal: 'center' }
      };
      ws['!merges'] = ws['!merges'] || [];
      ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });
      ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 7 } });
      ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 7 } });

      // Estilo: nombre prueba (fila 2) y título categorías (fila 3)
      if (ws['A2']) ws['A2'].s = { font: { bold: true, sz: 12 }, alignment: { horizontal: 'center' } };
      if (ws['A3']) ws['A3'].s = { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center' } };

      // Estilo: header de columnas (fila 5)
      for (let col = 0; col < 8; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 4, c: col });
        if (ws[cellRef]) ws[cellRef].s = {
          font: { bold: true, color: { rgb: 'FFFFFFFF' } },
          fill: { fgColor: { rgb: 'FF1a4731' } },
          alignment: { horizontal: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'FF000000' } },
            bottom: { style: 'thin', color: { rgb: 'FF000000' } },
            left: { style: 'thin', color: { rgb: 'FF000000' } },
            right: { style: 'thin', color: { rgb: 'FF000000' } }
          }
        };
      }

      // Estilo: filas A–G resaltadas (filas 6–12)
      for (let r = 5; r < 12; r++) {
        for (let col = 0; col < 8; col++) {
          const cellRef = XLSX.utils.encode_cell({ r, c: col });
          if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
          ws[cellRef].s = {
            fill: { fgColor: { rgb: 'FFFFF5CC' } }, // amarillo claro — último momento
            font: { bold: col === 0 },
            alignment: { horizontal: col === 0 ? 'center' : 'left' },
            border: {
              top: { style: 'thin', color: { rgb: 'FF999999' } },
              bottom: { style: 'thin', color: { rgb: 'FF999999' } },
              left: { style: 'thin', color: { rgb: 'FF999999' } },
              right: { style: 'thin', color: { rgb: 'FF999999' } }
            }
          };
        }
      }

      // Estilo: filas de datos con border
      const dataStart = 12;
      const dataEnd = dataStart + ordered.length;
      for (let r = dataStart; r < dataEnd; r++) {
        for (let col = 0; col < 8; col++) {
          const cellRef = XLSX.utils.encode_cell({ r, c: col });
          if (ws[cellRef]) ws[cellRef].s = {
            alignment: { horizontal: col === 0 ? 'center' : 'left', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'FF999999' } },
              bottom: { style: 'thin', color: { rgb: 'FF999999' } },
              left: { style: 'thin', color: { rgb: 'FF999999' } },
              right: { style: 'thin', color: { rgb: 'FF999999' } }
            }
          };
        }
      }

      // Anchos de columnas
      ws['!cols'] = [
        { wch: 5 },   // N°
        { wch: 30 },  // JINETE
        { wch: 25 },  // CABALLO
        { wch: 22 },  // CATEGORIA
        { wch: 6 },   // S
        { wch: 6 },   // D
        { wch: 8 },   // TOTAL
        { wch: 8 },   // PUESTO
      ];

      // Nombre de hoja (ej. "1° 0.60m")
      const shortNum = prueba.num.split(' ')[0].charAt(0) + '°';
      XLSX.utils.book_append_sheet(wb, ws, `${shortNum} ${prueba.altura}`);
    });

    // 7. Descargar
    const fecha = new Date().toISOString().split('T')[0];
    const filename = `Orden_Ingreso_${cdsTitle.replace(/\s+/g,'_')}_${diaPretty}_${fecha}.xlsx`;
    XLSX.writeFile(wb, filename);

    toast('Archivo descargado correctamente');
  } catch (err) {
    console.error('Error en downloadOrdenIngreso:', err);
    toast('Error: ' + err.message);
  }
}
