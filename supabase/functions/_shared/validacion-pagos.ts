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

// El modelo de OCR y el endpoint. Vivían en `validar-comprobante/index.ts` y se
// perdieron al mover `callClaudeVision()` acá el 20-ago-2026: la función quedó
// usando dos identificadores que ya no existían en ningún archivo. Resultado,
// desplegado y sin que nada avisara: `ReferenceError: CLAUDE_API is not defined`
// en TODA validación de comprobante entre el 20 y el 27 de agosto. El `catch`
// del llamado lo escribía como "Error OCR" y mandaba la fila a revisión manual,
// así que el sistema no rechazó a nadie — simplemente dejó de leer comprobantes,
// y las 8 inscripciones del XIII las verificó Daniel a mano, una por una.
const CLAUDE_MODEL = 'claude-sonnet-4-5';   // multimodal, soporta vision
const CLAUDE_API   = 'https://api.anthropic.com/v1/messages';

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
// 🔧 v23 (22-sep-2026): guía por banco. Medida en el harness sobre los 112 comprobantes del
// XIII y el XIV contra la tabla de verdad: N° de operación 75 % → 97 %, glosa 81 % → 100 %,
// banco 82 % → 98 %; BNB con error 26/36 → 3/36; Ganadero sigue 0/34. El texto fuente vive en
// scripts/ocr-harness/prompts/v23-banco.txt: cualquier cambio se mide ahí ANTES de tocarlo acá.
export const PROMPT_OCR = `You are an OCR specialist analyzing a Bolivian bank transfer or QR payment receipt (comprobante de pago bancario).

Extract these fields and return ONLY a single valid JSON object — no markdown, no commentary, no code fences.

Required JSON shape:
{
  "banco_origen": string|null,        // Bank that ISSUED this receipt (the payer's bank). Use one of: "BNB", "Banco Ganadero", "BCP", "Banco Mercantil Santa Cruz", "Banco Económico", "BancoSol", "BISA", "Banco Unión", or the printed name if another bank
  "formato_detectado": string|null,   // Short label of the receipt format you recognized (e.g. "BNB transferencia a terceros simple", "Ganadero Pago QR realizado", "BCP Banca Móvil transferencia", "Mercantil Transferencia exitosa", "Económico Pago con QR", "BancoSol altoke", "Unión UNI móvil"), or null if unknown
  "titular_origen": string|null,       // Name of the person/entity who paid, if printed
  "monto": number|null,                // Amount transferred, in Bs. Number only
  "moneda": "BOB"|"USD"|null,
  "fecha_pago": string|null,           // "YYYY-MM-DDTHH:MM:SS" — the date and time PRINTED on the receipt, as printed (local Bolivian time), no timezone suffix. Omit seconds if not printed ("YYYY-MM-DDTHH:MM")
  "nro_operacion": string|null,         // The bank's transaction/operation number — see the per-bank rules below. Copy it EXACTLY, character by character
  "cuenta_destino": string|null,        // Destination account number EXACTLY as printed, including any mask (e.g. "200****154")
  "titular_destino": string|null,       // Name of the recipient, if printed
  "banco_destino": string|null,         // Destination bank, if printed (often it is NOT printed for same-bank transfers: then null)
  "glosa": string|null,                 // The concept / reason / reference text of the transfer, as printed
  "tipo_transaccion": string|null,      // "transferencia" | "QR" | "deposito" | etc.
  "confianza": number,                  // YOUR confidence (0.0-1.0) that the extraction is reliable
  "notas": string|null                  // Caveats only: cut-off image, blurry, ambiguous fields. Do NOT copy account numbers into notes
}

STEP 1 — IDENTIFY THE BANK FIRST, then apply that bank's rules. The bank name is often ONLY in the logo or watermark (Mercantil Santa Cruz, Banco Unión): read it from the logo anyway and fill "banco_origen".

PER-BANK RULES (where each field is on each bank's receipt):

- BNB ("BNB — Comprobante Electrónico", green): "nro_operacion" = the value labelled "Bancarización Débito" — exactly 10 characters: 1 digit + 1 LETTER + 8 digits (count them; if you read 9 characters, one is missing: re-read or return null) (e.g. "2P75612112", "1P73708747", "2O01951503"; the second character is a letter, usually P, sometimes O). NEVER use "Bancarización Abono" (it is a different code), NEVER use the long "Comprobante:" string with asterisks (it contains dates, codes and account numbers and is NOT the operation number), and NEVER use "Referencia" — "Referencia" is the GLOSA. The origin account is masked and the destination bank is usually not printed (leave "banco_destino" null). Time is printed on its own line ("Hora de la transacción").
- Banco Ganadero ("¡Pago QR realizado!" / "¡Pago QR exitoso!", green): "nro_operacion" = "Número de operación" or "Nro." at the bottom, 9-10 digits. The glosa is the free text line below the amount (no label). Date and time are printed together ("21/09/2026 - 16:06 hrs"); no seconds.
- BCP / Banco de Crédito ("Banca Móvil — Comprobante", orange/blue): "nro_operacion" = "Número de transacción", 16 digits starting with "07"; if it is split across two lines, join the digits. The receipt has TWO blocks with the same inner labels ("A nombre de", "Del banco"): the block labelled "De la cuenta" is the ORIGIN and the block labelled "A la cuenta" is the DESTINATION — decide by the label, never by position (their order changes between variants). The glosa is "Motivo" (it may start with "BM QR "). Some variants do not print the destination name: then "titular_destino" is null — do not fill it with the payer.
- Banco Mercantil Santa Cruz ("¡Transferencia exitosa!" in the app, or "Transferencia realizada exitosamente" on the web; bank name only in the logo): "nro_operacion" = "Código" / "Código de transacción", 18-19 DIGITS starting with "1003" (digits only — never a letter; count them: if you read fewer than 18, re-read). "cuenta_destino" = the 10-digit number on the "Cuenta destino" line (e.g. 2000274154). The line "CI / NIT 6210702" (7-8 digits) under it is the holder's ID card — it is NEVER the account; do not put it in "cuenta_destino". "banco_origen" is "Banco Mercantil Santa Cruz" even though only the logo shows it.
- Banco Económico ("Pago con QR — Pago completado"): "nro_operacion" = "Nro. de transacción", 9 digits (not "Código de autorización"). The glosa is the preloaded field labelled "Nota:" or "Motivo:" — NEVER "Nota del cliente:" (that is free text typed by the payer; ignore it). "NIT o carnet" printed next to the destination is an ID, not the account.
- BancoSol ("altoke" / "¡Pago QR realizado!" purple / "BTS Transferencia ACH"): "nro_operacion" = "Transacción" or "Número de comprobante", formatted like "18092026/295/398/012/9405" — copy it WITH the slashes. Glosa = "Detalle" / "Descripción".
- BISA ("Pago QR realizado" / "Tu pago se realizó correctamente"): "nro_operacion" = "Número de transacción" (11 digits). The app variant also prints "Número de operación e-BISA" (9 digits): IGNORE it. In the destination block, "CI/NIT" is an ID, not the account; the account is the 10-digit line below the name.
- Banco Unión ("UNI móvil plus — COMPROBANTE DE PAGO"; bank name in the watermark): "nro_operacion" = "Transacción N°", 20 digits, usually split across two lines — join them. "Referencia" is the GLOSA.

GENERAL RULES:
- "nro_operacion" IS A CODE, NEVER A DESCRIPTION. Concept text like "XIV CDS 2026", "Pago Afiliacion Adescruz 2026" or a person's name is the GLOSA — put it in "glosa" and never in "nro_operacion". A wrong operation number is worse than null: the system treats it as a unique payment identifier.
- Copy numbers character by character. Where the bank's pattern says a position is a digit, read it as a digit (do not output "S" for "5", "O" for "0", "B" for "8"). If you genuinely cannot tell a character, set "nro_operacion" to null and explain in "notas" — do not guess.
- If a field is unclear or absent, use null. Do NOT invent data. Do not fill "banco_destino" or "titular_destino" when they are not printed.
- DATES ARE BOLIVIAN: numeric dates are DAY/MONTH/YEAR (DD/MM/YYYY). "01/06/2026" means 1 June 2026. Months may be written in Spanish ("9 de Septiembre, 2026 a las 19:28"). Output "fecha_pago" with day and month in the CORRECT positions and the time exactly as printed, no timezone.
- "monto" is the AMOUNT TRANSFERRED (not balance, not commission).
- "cuenta_destino": COPY IT EXACTLY AS PRINTED, INCLUDING THE MASK ("200****154", "•••• 4154"). Do not guess hidden digits, do not drop the mask characters.
- If the image is not a bank receipt (e.g. a list of account movements, a screenshot of a web form), set "confianza": 0 and say so in "notas".`;
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
// ─── Doble lectura: dos lecturas independientes tienen que coincidir ─────────
// Medido el 22-sep-2026 (harness, 112 comprobantes, 2 lecturas cada uno): los
// errores que quedaban tras la guía por banco eran de UN carácter (una S por un
// 5, un dígito de más en un Código del Mercantil) y ninguna forma los detecta.
// Dos lecturas con temperatura 1 casi nunca se equivocan igual: coincidieron
// 110 de 112, y las 2 que no, eran exactamente las mal leídas. Con esto, 0
// aprobaciones automáticas incorrectas en el set. Cuesta una llamada más
// (~US$0,015 por comprobante). Si la segunda lectura falla, no hay consenso:
// la fila va a revisión, no se aprueba sola con una lectura sin contraste.
export async function leerConConsenso(imageBase64: string, mediaType: string, apiKey: string) {
  const [r1, r2] = await Promise.allSettled([
    callClaudeVision(imageBase64, mediaType, apiKey),
    callClaudeVision(imageBase64, mediaType, apiKey),
  ]);
  if (r1.status === 'rejected') throw r1.reason;         // sin primera lectura no hay nada
  const extracted = r1.value;
  if (r2.status === 'rejected') {
    return { extracted, consenso: { coincide: false, motivo: `la segunda lectura falló: ${r2.reason?.message || r2.reason}`, nro2: null, monto2: null } };
  }
  const n1 = normalizarNroOperacion(extracted?.nro_operacion), n2 = normalizarNroOperacion(r2.value?.nro_operacion);
  const m1 = Number(extracted?.monto), m2 = Number(r2.value?.monto);
  const coincide = !!n1 && n1 === n2 && Number.isFinite(m1) && m1 === m2;
  const motivo = coincide ? null
    : `las dos lecturas del comprobante no coinciden (N° "${n1 ?? '—'}" vs "${n2 ?? '—'}", monto ${isNaN(m1) ? '—' : m1} vs ${isNaN(m2) ? '—' : m2})`;
  return { extracted, consenso: { coincide, motivo, nro2: n2, monto2: isNaN(m2) ? null : m2 } };
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
// ─── La cuenta destino, cuando el banco la tapa ─────────────────────────────
//
// El diseño de dos baldes se apoya en que `cuenta_destino` es "un número de 10
// dígitos, robusto al OCR, y por eso la IDENTIDAD". El 27-ago-2026 se descubrió
// que ese supuesto es falso para el formato que manda la mayoría: el banco
// imprime la cuenta ENMASCARADA — "200****154" en vez de "2000274154". La
// comparación por igualdad exacta fallaba, la cuenta caía al balde duro y el
// pago se auto-rechazaba. Tercera vez que el criterio falla para el mismo lado.
//
// Cuatro veredictos, no dos, porque "no pude verificar" NO es "fue a otra
// cuenta":
//   exacta      — se leyó completa y coincide. Ancla firme.
//   enmascarada — los dígitos visibles calzan con los nuestros. Ancla firme:
//                 un impostor tendría que compartir prefijo Y sufijo Y titular.
//   distinta    — se leyó y NO es la nuestra. Único caso donde de verdad
//                 sabemos que el dinero no llegó → balde duro.
//   ilegible    — no se pudo leer, o hay tan poco a la vista que no prueba
//                 nada. NO es evidencia de que fue a otro lado → balde blando,
//                 lo mira una persona.
export type MatchCuenta = 'exacta' | 'enmascarada' | 'distinta' | 'ilegible';

export function clasificarCuentaDestino(
  leida: string | null | undefined,
  esperada: string,
): MatchCuenta {
  if (!leida) return 'ilegible';
  // Fuera espacios, puntos y guiones: son separadores de formato, no dígitos.
  const norm = String(leida).replace(/[\s.\-]/g, '');
  if (!norm) return 'ilegible';
  if (norm === esperada) return 'exacta';

  const MASCARA = /[*xX•·#]/;
  if (!MASCARA.test(norm)) {
    // Sin máscara: si son puros dígitos, se leyó una cuenta y no es la nuestra.
    // Si trae cualquier otra cosa, la lectura está corrupta y no prueba nada.
    return /^[0-9]+$/.test(norm) ? 'distinta' : 'ilegible';
  }
  if (!/^[0-9*xX•·#]+$/.test(norm)) return 'ilegible';

  const prefijo = norm.match(/^[0-9]*/)![0];
  const sufijo  = norm.match(/[0-9]*$/)![0];

  // Con 4 dígitos o menos a la vista, calzar no significa nada: hay demasiadas
  // cuentas que terminan igual. No alcanza para anclar, pero tampoco para
  // rechazar → ilegible (blando).
  if (prefijo.length + sufijo.length <= 4) return 'ilegible';
  if (prefijo.length + sufijo.length > esperada.length) return 'ilegible';

  return (esperada.startsWith(prefijo) && esperada.endsWith(sufijo))
    ? 'enmascarada'
    : 'distinta';   // lo visible CONTRADICE nuestra cuenta: fue a otro lado
}

// ─── El N° de operación: un código, nunca una frase ─────────────────────────
//
// El 27-ago-2026 el OCR devolvió `nro_operacion: "XIII CDS 2026"` — o sea, la
// GLOSA— y el trigger de anti-reúso la reservó en `operaciones_consumidas` como
// si fuera el identificador único del pago. Esa cadena la comparten TODOS los
// pagos del concurso: la reserva no protegía nada y, peor, el trigger lanza
// excepción ante el segundo choque → la siguiente aprobación quedaba BLOQUEADA.
//
// Se corrigió el prompt para que no confunda los campos, pero un prompt no es
// determinístico y este valor va a una PK. Este guard sí lo es: un N° de
// operación real es un código sin espacios y con dígitos suficientes. Lo que no
// lo parece se descarta, y la fila cae a revisión manual por "no se pudo leer
// el N° de operación" — que es exactamente lo que pasó.
//
// 🔧 18-sep-2026: tampoco puede ser NUESTRA cuenta. El comprobante del BNB trae
// un campo "Comprobante: …*BNB*2000274154*17/09/2026" y el OCR sacó de ahí la
// cuenta de ADESCRUZ como N° de operación. Se reservó al aprobar y quedó como
// una mina: todo comprobante del BNB lleva esa cuenta adentro, así que el
// siguiente que la leyera igual chocaba como "comprobante repetido".
export function normalizarNroOperacion(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/\s/.test(s)) return null;                    // "XIII CDS 2026" — es una frase
  if ((s.match(/[0-9]/g) || []).length < 5) return null;  // pocos dígitos: no es un comprobante
  if (s.length > 40) return null;                   // desbordes de lectura
  if (s.replace(/[^0-9]/g, '') === VALIDACION.cuenta_destino) return null;  // es la cuenta de ADESCRUZ
  return s;
}

// ─── La forma del N° de operación, banco por banco ───────────────────────────
// Medida en los 112 comprobantes del XIII y el XIV (tabla de verdad, 22-sep-2026)
// y escrita en la guía por banco del cerebro:
//   BNB        1 dígito + 1 LETRA + 8 dígitos («Bancarización Débito»: 2P75612112, 2O01951503)
//   Ganadero   9-10 dígitos («Número de operación» / «Nro.»)
//   BCP        16 dígitos, 07 + AAMMDD + 8 («Número de transacción»)
//   Mercantil  18-19 dígitos, 1003 + AAAAMMDD + contador diario sin ceros («Código»)
//   Económico  9 dígitos («Nro. de transacción»)
//   BancoSol   DDMMAAAA/999/999/999/9999 (con barras)
//   BISA       11 dígitos («Número de transacción»; el «e-BISA» de 9 no es)
//   Unión      20 dígitos («Transacción N°», en dos renglones)
// Un N° que no tiene la forma de su banco es casi seguro una lectura cortada o
// con un carácter cambiado: no se rechaza, va a revisión. Banco no reconocido →
// null (no se chequea).
const FORMAS_NRO: Array<{ banco: string; re: RegExp; forma: RegExp; esperado: string }> = [
  { banco: 'BNB',       re: /\bbnb\b|banco\s+nacional/i,                    forma: /^\d[A-Z]\d{8}$/i,           esperado: '1 dígito + 1 letra + 8 dígitos' },
  { banco: 'Ganadero',  re: /ganadero/i,                                     forma: /^\d{9,10}$/,                esperado: '9 o 10 dígitos' },
  { banco: 'BCP',       re: /\bbcp\b|banco\s+de\s+cr[eé]dito/i,              forma: /^07\d{14}$/,                esperado: '16 dígitos que empiezan con 07' },
  { banco: 'Mercantil', re: /mercantil|\bbmsc\b/i,                           forma: /^1003\d{14,15}$/,           esperado: '18 o 19 dígitos que empiezan con 1003' },
  { banco: 'Económico', re: /econ[oó]mico/i,                                 forma: /^\d{9}$/,                   esperado: '9 dígitos' },
  { banco: 'BancoSol',  re: /bancosol|banco\s+sol\b|solidario/i,             forma: /^\d{8}(\/\d{3,4}){2,4}$/,  esperado: 'DDMMAAAA/999/999/999/9999' },
  { banco: 'BISA',      re: /\bbisa\b/i,                                     forma: /^\d{11}$/,                  esperado: '11 dígitos' },
  { banco: 'Unión',     re: /uni[oó]n/i,                                     forma: /^\d{20}$/,                  esperado: '20 dígitos' },
];
export function formaNroOperacion(nro: string, bancoOrigen: unknown): { banco: string; valida: boolean; esperado: string } | null {
  const b = String(bancoOrigen ?? '');
  const f = FORMAS_NRO.find((x) => x.re.test(b));
  if (!f) return null;
  return { banco: f.banco, valida: f.forma.test(nro.trim()), esperado: f.esperado };
}

// La hora de un comprobante es la IMPRESA, en hora de Bolivia (UTC−4, sin horario
// de verano): se pasa a UTC SUMANDO 4 horas. Antes del 21-sep-2026 el intento 0
// hacía `new Date("2026-09-17T06:27:09")`, que a una fecha sin huso la toma en la
// zona del SERVIDOR — la Edge Function corre en UTC —, y los intentos 1 y 2
// RESTABAN 4 horas: fecha_pago quedaba 4 (u 8) horas antes del pago real.
const BOLIVIA_UTC_OFFSET_H = 4;
function horaBoliviaAIso(y: number, mes0: number, d: number, h = 0, mi = 0, s = 0): string | null {
  if (mes0 < 0 || mes0 > 11 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const t = Date.UTC(y, mes0, d, h + BOLIVIA_UTC_OFFSET_H, mi, s);
  return isNaN(t) ? null : new Date(t).toISOString();
}

export function parseFechaPago(s: string | null | undefined): string | null {
  if (!s || typeof s !== 'string') return null;
  const trimmed = s.trim();

  // Intento 0: ISO 8601 (YYYY-MM-DD[THH:MM[:SS]]). Es la hora impresa en el
  // comprobante: sin huso, o con una «Z» que el OCR no puede saber (no ve UTC en
  // ningún lado), se toma como hora de Bolivia. Solo un huso explícito distinto
  // de Z (p. ej. -04:00) se respeta tal cual.
  const mIso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i);
  if (mIso) {
    const huso = mIso[7];
    if (huso && huso.toUpperCase() !== 'Z') {
      const iso = new Date(trimmed);
      if (!isNaN(iso.getTime())) return iso.toISOString();
    } else {
      const r = horaBoliviaAIso(+mIso[1], +mIso[2] - 1, +mIso[3], +(mIso[4] || 0), +(mIso[5] || 0), +(mIso[6] || 0));
      if (r) return r;
    }
  }

  // Intento 1: formato boliviano numérico DD/MM/YYYY o DD-MM-YYYY (DÍA PRIMERO), con hora opcional.
  // OJO: new Date("01/06/2026") en JS asume MM/DD (gringo) y da 6-ene. Por eso parseamos a mano.
  const mNum = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[\sT,]+(\d{1,2}):(\d{2}))?/);
  if (mNum) {
    let day = parseInt(mNum[1], 10), month = parseInt(mNum[2], 10), year = parseInt(mNum[3], 10);
    if (year < 100) year += 2000;
    const hour = mNum[4] ? parseInt(mNum[4], 10) : 0;
    const min  = mNum[5] ? parseInt(mNum[5], 10) : 0;
    const r = horaBoliviaAIso(year, month - 1, day, hour, min);
    if (r) return r;
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
      const r = horaBoliviaAIso(year, month, day, hour, min);
      if (r) return r;
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
// 🔧 Desde el 18-sep-2026 los duros TAMPOCO rechazan: van a revisión manual con
// el motivo marcado "⚠️ Posible pago a otra cuenta". Ver el final de la función.
//
// LA CUENTA ES EL ANCLA — pero un ancla que el banco a veces tapa. Se compara
// con `clasificarCuentaDestino()`, que acepta la forma enmascarada ("200****154")
// y solo trata como duro el caso en que se leyó una cuenta y NO es la nuestra.
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
  // 🔧 TERCERA RECALIBRACIÓN (27-ago-2026): la cuenta viene ENMASCARADA.
  // Antes esto era una igualdad exacta, y el "200****154" que imprime el banco
  // la hacía fallar → balde duro → pago legítimo auto-rechazado. Ahora se
  // clasifica en cuatro, y solo "distinta" (se leyó y NO es la nuestra) rechaza.
  const matchCuenta = clasificarCuentaDestino(extracted.cuenta_destino, VALIDACION.cuenta_destino);
  const cuentaOk = matchCuenta === 'exacta' || matchCuenta === 'enmascarada';

  if (matchCuenta === 'distinta') {
    duros.push(`Cuenta destino: esperada ${VALIDACION.cuenta_destino}, leyó "${extracted.cuenta_destino}"`);
  } else if (matchCuenta === 'ilegible') {
    blandos.push(`Cuenta destino ilegible: leyó "${extracted.cuenta_destino || '—'}"`
      + ` (no se pudo confirmar que el pago llegó a la cuenta de ADESCRUZ, pero tampoco que no)`);
  }

  // Con la cuenta anclada (exacta o enmascarada), un titular o banco raros son
  // casi con certeza un artefacto de lectura → blandos. Sin ancla, tampoco
  // rechazan solos: que no se pueda verificar no prueba que el dinero no llegó.
  const balde = cuentaOk ? blandos : (matchCuenta === 'ilegible' ? blandos : duros);

  // 🔧 QUINTA RECALIBRACIÓN (22-sep-2026): NO CASTIGAR LO QUE EL BANCO NO IMPRIME.
  // Un comprobante BNB→BNB no trae el banco destino; la variante Android del BCP
  // no trae el nombre del destinatario. Con la cuenta anclada, un campo AUSENTE
  // no es una señal de nada: la tabla de verdad del XIII+XIV mostró 39 lecturas
  // correctas mandadas a revisión solo por «Banco destino: leyó —». Ausente y
  // cuenta anclada → se ignora. PRESENTE y distinto → blando (error de lectura
  // probable). Sin ancla de cuenta, todo sigue como antes: ausente o distinto
  // van al balde que corresponda, porque no hay otra forma de saber adónde fue.
  const titularLeido = String(extracted.titular_destino || '').trim();
  const bancoLeido = String(extracted.banco_destino || '').trim();
  if (titularLeido ? !VALIDACION.titular_destino_re.test(titularLeido) : !cuentaOk) {
    balde.push(`Titular destino: leyó "${titularLeido || '—'}"`
      + (cuentaOk ? ' (la cuenta destino SÍ coincide — probable error de lectura)' : ''));
  }
  if (bancoLeido ? !VALIDACION.banco_destino_re.test(bancoLeido) : !cuentaOk) {
    balde.push(`Banco destino: leyó "${bancoLeido || '—'}"`
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
  // Se mira el N° YA NORMALIZADO, no el crudo: si el guard lo descartó (la
  // glosa, nuestra cuenta, un desborde), no hay con qué chequear el reúso y
  // aprobarlo igual dejaba el comprobante sin protección (caso Naia Majluf,
  // 17-sep: el mismo archivo aprobado dos veces).
  const nroNorm    = normalizarNroOperacion(extracted.nro_operacion);
  const faltaNro   = !nroNorm;
  // 🔧 22-sep-2026: el N° tiene que tener la FORMA del banco que lo emitió. Al
  // dejar de castigar lo que el banco no imprime, aprobaban solos comprobantes
  // cuyo N° el OCR había leído CORTADO (BNB de 9 caracteres: «2P2131986») o con
  // una letra donde va un dígito: se reservaba un N° que no existe. Medido en el
  // harness sobre 112 comprobantes: 4 de 6 aprobaciones incorrectas eran de forma
  // inválida. Forma inválida → revisión (no rechaza). Banco desconocido → no se
  // chequea (no hay forma conocida).
  const formaNro   = nroNorm ? formaNroOperacion(nroNorm, extracted.banco_origen) : null;

  // Duros (cuenta / titular / banco destino que contradicen los nuestros) →
  // TAMBIÉN revisión manual. El robot ya no rechaza nunca.
  //
  // 🔧 CUARTA RECALIBRACIÓN (18-sep-2026), decisión de Daniel: «que todos vayan
  // a revisión manual y les salga a ellos en revisión». La auditoría de los 60
  // comprobantes reales del XIII y el XIV mostró que CADA rechazo automático
  // del balde duro fue un pago correcto mal leído: el CI/NIT del titular tomado
  // como cuenta (Mercantil, 3 veces), origen y destino invertidos (BCP). El
  // rechazo asustaba a gente que había pagado bien, y ningún caso real de pago
  // a otra cuenta lo compensó.
  //
  // El balde duro se conserva como CLASIFICACIÓN: el motivo sale marcado para
  // que el admin lo mire primero, pero el estado es el mismo que un blando.
  if (duros.length > 0) {
    const todos = duros.concat(blandos).join('; ');
    const conf = confianza < 0.5 ? ` (OCR poco confiable: ${confianza})` : '';
    return { estado: 'revision_manual', motivo: `⚠️ Posible pago a otra cuenta${conf}: ${todos}` };
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
  if (formaNro && !formaNro.valida) revision.push(`N° de operación con forma inválida para ${formaNro.banco}: "${nroNorm}" (se esperaba ${formaNro.esperado})`);
  if (opts.exigirMonto && extracted.monto == null) revision.push('no se pudo leer el monto del comprobante');
  if (revision.length) return { estado: 'revision_manual', motivo: revision.join('; ') };

  return { estado: 'aprobada', motivo: null };
}