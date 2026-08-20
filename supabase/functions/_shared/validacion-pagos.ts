// ============================================================================
// _shared/validacion-pagos.ts
//
// Núcleo compartido por `validar-comprobante` (inscripciones) y
// `validar-comprobante-afiliacion`. Antes estaba DUPLICADO en los dos
// archivos, y eso costó caro: entre el 18 y el 20-ago se recalibró dos veces
// la clasificación de errores en inscripciones, y la de afiliaciones se comió
// las dos sin enterarse — siguió auto-rechazando pagos legítimos.
//
// Regla que queda: cualquier cambio de criterio de validación va ACÁ, una sola
// vez, y se redespliegan las DOS funciones. Un módulo compartido no se
// despliega solo: Supabase lo empaqueta dentro del bundle de cada función.
// ============================================================================

export const VALIDACION = {
  cuenta_destino: '2000274154',
  titular_destino_re: /bedoya\s+alipaz\s+nicol/i,
  // Acepta: "Banco Nacional", "Banco Nacional de Bolivia", "BNB", "B.N.B.", "B N B"
  banco_destino_re:   /banco\s*nacional(?:\s+de\s+bolivia)?|\bb\.?\s*n\.?\s*b\.?\b/i,
  ventana_dias_atras: 60,  // comprobante no puede ser más viejo que esto
};
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
export const PROMPT_OCR = `You are an OCR specialist analyzing a Bolivian bank transfer receipt (comprobante de pago bancario).

Extract these fields and return ONLY a single valid JSON object — no markdown, no commentary, no code fences.

Required JSON shape:
{
  "banco_origen": string|null,        // e.g. "Banco Ganadero", "BMSC", "Banco Mercantil Santa Cruz"
  "titular_origen": string|null,       // Name of the person/entity who paid
  "monto": number|null,                // Amount in Bs. Number only, no currency symbol
  "moneda": "BOB"|"USD"|null,
  "fecha_pago": string|null,           // ISO 8601 with time if visible (YYYY-MM-DDTHH:MM:SS), Bolivia timezone
  "nro_operacion": string|null,         // Transaction/operation/reference number
  "cuenta_destino": string|null,        // Destination account number
  "titular_destino": string|null,       // Name of recipient
  "banco_destino": string|null,         // Destination bank name
  "glosa": string|null,                 // Reason / concept / "concepto" / description
  "tipo_transaccion": string|null,      // "transferencia" | "QR" | "deposito" | etc.
  "confianza": number,                  // YOUR confidence (0.0-1.0) that the extraction is reliable
  "notas": string|null                  // Any caveats: image cut off, blurry, ambiguous fields
}

Rules:
- If a field is unclear or absent, use null. Do NOT invent data.
- DATES ARE BOLIVIAN: numeric dates are DAY/MONTH/YEAR (DD/MM/YYYY). Example: "01/06/2026" means 1 June 2026, NOT January 6. Output "fecha_pago" as ISO 8601 (YYYY-MM-DDTHH:MM:SS) with the day and month in the CORRECT positions.
- "monto" is the AMOUNT TRANSFERRED (not balance, not commission). Look for "monto", "importe", "total", "Bs."
- Bolivian receipts often show "operación N°" or "número de operación" or "referencia" — that's "nro_operacion".
- For QR payments, "banco_destino" may be inferred from the recipient's account prefix or QR provider.
- If you cannot find ANY of the fields (image is not a receipt), set "confianza": 0 and "notas": "Not a bank receipt".`;
export function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
export async function callClaudeVision(imageBase64: string, mediaType: string, apiKey: string) {
  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          // PDF se manda como bloque 'document'; imágenes como 'image'. (Claude rechaza un PDF dentro de 'image'.)
          mediaType === 'application/pdf'
            ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: imageBase64 } }
            : { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: PROMPT_OCR },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Claude API ${res.status}: ${txt}`);
  }
  const json = await res.json();
  const text = json?.content?.[0]?.text;
  if (!text) throw new Error('Claude returned no text content');
  // Strip code fences if Claude added them despite instructions
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); }
  catch (e) { throw new Error(`Claude returned non-JSON: ${cleaned.slice(0, 200)}`); }
}
export function detectMediaType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'png')  return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif')  return 'image/gif';
  if (ext === 'pdf')  return 'application/pdf';  // Claude soporta PDFs en algunos modelos
  return 'image/jpeg';
}
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
export function parseFechaPago(s: string | null | undefined): string | null {
  if (!s || typeof s !== 'string') return null;
  const trimmed = s.trim();

  // Intento 0: ISO 8601 explícito (YYYY-MM-DD...). No es ambiguo → parse directo.
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const iso = new Date(trimmed);
    if (!isNaN(iso.getTime())) return iso.toISOString();
  }

  // Intento 1: formato boliviano numérico DD/MM/YYYY o DD-MM-YYYY (DÍA PRIMERO), con hora opcional.
  // OJO: new Date("01/06/2026") en JS asume MM/DD (gringo) y da 6-ene. Por eso parseamos a mano.
  const mNum = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[\sT,]+(\d{1,2}):(\d{2}))?/);
  if (mNum) {
    let day = parseInt(mNum[1], 10), month = parseInt(mNum[2], 10), year = parseInt(mNum[3], 10);
    if (year < 100) year += 2000;
    const hour = mNum[4] ? parseInt(mNum[4], 10) : 0;
    const min  = mNum[5] ? parseInt(mNum[5], 10) : 0;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = new Date(Date.UTC(year, month - 1, day, hour - 4 /* Bolivia UTC-4 */, min));
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  // Intento 2: español "DD de Mes, YYYY a las HH:MM" o "DD de Mes de YYYY HH:MM"
  const meses: Record<string, number> = {
    enero:0, febrero:1, marzo:2, abril:3, mayo:4, junio:5,
    julio:6, agosto:7, septiembre:8, setiembre:8, octubre:9, noviembre:10, diciembre:11
  };
  const norm = trimmed.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const m = norm.match(/(\d{1,2})\s*de\s*([a-z]+)[,\s]+(?:de\s+)?(\d{4})(?:[\s,]+(?:a\s*las\s*)?(\d{1,2}):(\d{2}))?/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = meses[m[2]];
    const year = parseInt(m[3], 10);
    const hour = m[4] ? parseInt(m[4], 10) : 0;
    const min  = m[5] ? parseInt(m[5], 10) : 0;
    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
      const d = new Date(Date.UTC(year, month, day, hour - 4 /* Bolivia UTC-4 */, min));
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  // Intento 3 (último recurso): parser genérico de JS para otros formatos.
  const direct = new Date(trimmed);
  if (!isNaN(direct.getTime())) return direct.toISOString();

  return null;
}

// ─── El criterio de validación ──────────────────────────────────────────────
//
// DOS BALDES, y una sola pregunta los separa: ¿el dinero llegó a la cuenta de
// ADESCRUZ?
//
//   duros   → NO llegó. No hay nada que un humano pueda rescatar: rechazada.
//   blandos → SÍ llegó, pero algo no cuadra. Decide una persona, nunca el robot.
//
// LA CUENTA ES EL ANCLA. `cuenta_destino` es un número: robusto al OCR.
// `titular` y `banco` son nombres: frágiles al recorte y la resolución. Si la
// cuenta coincide, un nombre raro es casi seguro un error de lectura y no otro
// destinatario, así que baja a blando.
//
// Los dos casos reales que forjaron esto:
//   · Fharid Galvis  — pagó Bs 200 de 250 y escribió mal la glosa. Auto-rechazado.
//   · Evie Davies    — captura cortada: el OCR leyó "alidaz" por "alipaz". Auto-rechazado.
// Los dos habían pagado. Ninguna versión previa aprobó nunca algo indebido:
// el sesgo del criterio original era siempre hacia rechazar de más.
//
// opts:
//   expected       monto esperado en Bs
//   ventanaDesde   fecha mínima aceptable del comprobante
//   glosaEsperada  texto que debe contener la glosa (null = no se exige)
//   cierreFecha    solo inscripciones: si el pago es posterior al cierre del CDS
//   exigirMonto    solo afiliaciones: manda a revisión si no se pudo leer el monto
export function validarPago(
  extracted: any,
  opts: {
    expected: number;
    ventanaDesde: Date;
    glosaEsperada: string | null;
    cierreFecha?: Date | null;
    exigirMonto?: boolean;
  },
): { estado: string; motivo: string | null } {
  const { expected, ventanaDesde, glosaEsperada } = opts;
  const cierreFecha = opts.cierreFecha ?? null;

  // ── DOS BALDES, NO UNO ────────────────────────────────────────────────────
  // La línea de corte es una sola pregunta: ¿el dinero llegó a la cuenta de
  // ADESCRUZ?
  //
  //   duros   → NO llegó (o el comprobante no es de un pago a nosotros).
  //             No hay nada que un humano pueda rescatar: se rechaza solo.
  //   blandos → SÍ llegó, pero algo no cuadra (monto, glosa, fecha, moneda).
  //             La plata ya está transferida: decide una persona, no el robot.
  //
  // Por qué: el 18-ago-2026 la PRIMERA inscripción real de la historia se
  // auto-rechazó por monto bajo + glosa mal escrita. El jinete había pagado de
  // verdad; solo puso "Fharid concurso" en el concepto y le faltaban Bs 50.
  // Rechazarlo solo, sin que nadie mire, es el peor primer contacto posible con
  // el sistema — y además le sacaba a ADESCRUZ la chance de cobrar la
  // diferencia o aplicar la tarifa de último momento.
  //
  // Ojo: nada de esto vuelve más permisiva la APROBACIÓN automática. Solo
  // mueve casos de "rechazada" a "revision_manual". Un blando nunca aprueba.
  const duros: string[] = [];
  const blandos: string[] = [];

  // ── EL NÚMERO DE CUENTA MANDA; EL NOMBRE SOLO CORROBORA ───────────────────
  // La cuenta destino es un número de 10 dígitos: robusto al OCR. Si coincide
  // exacta, el dinero llegó a la cuenta de ADESCRUZ y no hay más que discutir.
  //
  // El titular y el banco son NOMBRES: frágiles al OCR, al recorte y a la
  // resolución. Son corroboración, no identidad.
  //
  // Caso real (Evie Davies, 18-ago-2026): el jinete mandó la captura de un
  // comprobante que ese banco genera en PDF. La captura salió cortada justo
  // abajo de las letras, así que el OCR leyó "alidaz" en vez de "alipaz" —le
  // faltaba el trazo inferior de la p— y la inscripción se auto-rechazó. El
  // pago era correcto y Daniel tuvo que aprobarla a mano.
  //
  // Por eso: si la CUENTA coincide, un titular o banco raros son casi con
  // certeza un artefacto de lectura, no un destinatario distinto → blandos,
  // los mira una persona. Si la cuenta NO coincide (o no se pudo leer), no hay
  // ancla y todo vuelve a ser duro.
  const cuentaOk = !!extracted.cuenta_destino &&
    String(extracted.cuenta_destino).replace(/\s/g, '') === VALIDACION.cuenta_destino;

  if (!cuentaOk) {
    duros.push(`Cuenta destino: esperada ${VALIDACION.cuenta_destino}, leyó "${extracted.cuenta_destino || '—'}"`);
  }

  const balde = cuentaOk ? blandos : duros;   // con cuenta buena, el nombre no rechaza solo

  if (!extracted.titular_destino || !VALIDACION.titular_destino_re.test(extracted.titular_destino)) {
    balde.push(`Titular destino: leyó "${extracted.titular_destino || '—'}"`
      + (cuentaOk ? ' (la cuenta destino SÍ coincide — probable error de lectura)' : ''));
  }
  if (!extracted.banco_destino || !VALIDACION.banco_destino_re.test(extracted.banco_destino)) {
    balde.push(`Banco destino: leyó "${extracted.banco_destino || '—'}"`
      + (cuentaOk ? ' (la cuenta destino SÍ coincide — probable error de lectura)' : ''));
  }
  // Monto bajo — el dinero llegó, falta plata. Regla ya escrita en el cerebro:
  // "el monto no rechaza, marca". El código no la cumplía; ahora sí.
  const monto = Number(extracted.monto || 0);
  if (monto < expected) {
    blandos.push(`Monto bajo: pagó Bs ${monto}, esperaba Bs ${expected}`);
  }
  // Moneda — o pagó en otra moneda, o el OCR leyó mal. En los dos casos hay un
  // pago real detrás: que lo mire alguien.
  if (extracted.moneda && extracted.moneda !== 'BOB') {
    blandos.push(`Moneda: ${extracted.moneda} (debe ser BOB)`);
  }
  // Fechas — un comprobante viejo o posterior al cierre sigue siendo un pago
  // real. El reúso de comprobantes NO se defiende acá: lo corta
  // `operaciones_consumidas` por N° de operación. Y un pago tarde puede
  // convenir aceptarlo con la tarifa de último momento; esa es decisión de
  // ADESCRUZ, no del validador.
  if (extracted.fecha_pago) {
    const fp = new Date(extracted.fecha_pago);
    if (isNaN(fp.getTime())) {
      blandos.push('Fecha de pago no parseable');
    } else {
      if (fp < ventanaDesde) {
        blandos.push(`Comprobante muy viejo (fecha ${extracted.fecha_pago})`);
      }
      if (cierreFecha && fp > cierreFecha) {
        const cierreLocal = cierreFecha.toLocaleString('es-BO', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
          timeZone: 'America/La_Paz',
        });
        blandos.push(`Comprobante posterior al cierre del CDS (cerró ${cierreLocal})`);
      }
    }
  }
  // Glosa: comprobante debe contener la glosa esperada del CDS
  if (glosaEsperada) {
    const glosaCompro = String(extracted.glosa || '').trim();
    if (!glosaCompro) {
      blandos.push(`Glosa: el comprobante no tiene concepto (se esperaba "${glosaEsperada}")`);
    } else {
      // Case-insensitive, sin acentos y con LÍMITES DE PALABRA: evita que "I CDS 2026"
      // matchee dentro de "II CDS 2026" (números romanos que son prefijo de otros).
      const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reGlosa = new RegExp('\\b' + esc(norm(glosaEsperada).trim()) + '\\b');
      if (!reGlosa.test(norm(glosaCompro))) {
        blandos.push(`Glosa: leyó "${glosaCompro}", esperaba que contenga "${glosaEsperada}"`);
      }
    }
  }

  const confianza = Number(extracted.confianza || 0);
  const faltaFecha = !extracted.fecha_pago;
  const faltaNro   = !extracted.nro_operacion;

  // Duros (cuenta / titular / banco destino) → rechazada: el dinero no llegó a
  // ADESCRUZ. Salvo que el OCR sea poco confiable, en cuyo caso lo mira un humano.
  // Si además hay blandos, se informan todos juntos para no obligar al jinete a
  // descubrir los problemas de a uno.
  if (duros.length > 0) {
    const todos = duros.concat(blandos).join('; ');
    if (confianza < 0.5) return { estado: 'revision_manual', motivo: `OCR poco confiable (${confianza}): ${todos}` };
    return { estado: 'rechazada', motivo: todos };
  }

  // Sin duros pero con blandos → revisión manual. El pago existe; lo aprueba o lo
  // rechaza una persona desde el admin. NUNCA se aprueba solo.
  if (blandos.length > 0) {
    return { estado: 'revision_manual', motivo: blandos.join('; ') };
  }

  // Sin errores, pero con datos incompletos o baja confianza → revisión manual.
  // No aprobamos automáticamente algo que no pudimos verificar del todo.
  const revision: string[] = [];
  if (confianza < 0.7) revision.push(`OCR poco confiable (${confianza})`);
  if (faltaFecha)      revision.push('no se pudo leer la fecha del comprobante');
  if (faltaNro)        revision.push('no se pudo leer el N° de operación (no se puede chequear reúso)');
  if (opts.exigirMonto && extracted.monto == null) revision.push('no se pudo leer el monto del comprobante');
  if (revision.length) return { estado: 'revision_manual', motivo: revision.join('; ') };

  return { estado: 'aprobada', motivo: null };
}