# Harness de medición del lector de comprobantes (OCR)

Vuelve a leer los comprobantes reales del XIII y el XIV CDS (y las afiliaciones con comprobante)
con el prompt de producción o con un prompt candidato, y compara campo por campo contra una
**tabla de verdad** y contra la lectura vieja guardada en la base. Sirve para responder, con
números y antes de desplegar, «¿este prompt lee mejor que el actual?» — con el criterio de la
auditoría del 21-sep-2026: **cero aprobaciones automáticas incorrectas** y **Ganadero sigue en 0
errores**.

- **Solo lectura.** Consulta PostgREST (`SELECT`) y baja del bucket privado `comprobantes` con la
  clave de servicio. No escribe en Supabase, no despliega, no toca las Edge Functions ni el sitio.
- **Sin dependencias.** Node ≥ 22.18 (probado con 26): `fetch` nativo y los `.ts` del módulo
  compartido se importan tal cual (Node les quita los tipos). Python 3 con **PIL** para comprimir.
- **Secretos** en `adescruz-app/.env.local` (ignorado por git): `ANTHROPIC_API_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`. Se leen desde `lib.mjs` y **nunca se
  imprimen**; si faltan, el script falla nombrando la variable (no el valor).
- **Nada se guarda en el repo**: imágenes, lecturas e informes van a `HARNESS_DIR` (por defecto
  `$TMPDIR/adescruz-ocr-harness`). Son recibos bancarios con nombres, muchos de menores: borrarlos
  al terminar y no copiar cuentas de origen a ningún informe.

## Cómo se corre

Desde `adescruz-app/`. El flag `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` solo silencia el
aviso de Node al importar el `.ts` compartido (el `package.json` del repo no declara `type`).

```bash
export HARNESS_DIR=/ruta/fuera/del/repo          # dónde van imágenes y salidas
N="node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON"

$N scripts/ocr-harness/listar.mjs                # 1. set.json: filas + archivos únicos + lectura vieja
$N scripts/ocr-harness/bajar.mjs                 # 2. orig/ (reanudable: no vuelve a bajar lo que ya está)
python3 scripts/ocr-harness/comprimir.py         # 3. comp/ con las reglas de comprimir.js
$N scripts/ocr-harness/leer.mjs --prompt actual --set comp --rep 1        # 4. lecturas_actual.json
$N scripts/ocr-harness/comparar.mjs --lecturas $HARNESS_DIR/lecturas_actual.json \
     --verdad /ruta/verdad_xiii_xiv.json --out $HARNESS_DIR/informe_actual.md   # 5. informe
```

Para probar un prompt candidato: guardarlo en un `.txt` (por ejemplo `scripts/ocr-harness/prompts/v22.txt`)
y correr `leer.mjs --prompt scripts/ocr-harness/prompts/v22.txt --rep 3`, luego `comparar.mjs` con esa
salida. Los informes de dos prompts se leen lado a lado: mismas tablas, mismo set.

### Flags útiles

| Script | Flag | Qué hace |
|---|---|---|
| `bajar.mjs` | `--rehacer` | vuelve a bajar todo · `--conc N` paralelismo (3) |
| `comprimir.py` | `--orig/--comp/--out` | rutas; por defecto las de `HARNESS_DIR` |
| `leer.mjs` | `--prompt actual\|ruta.txt` | «actual» importa `PROMPT_OCR` del módulo compartido: mide exactamente producción |
| | `--set comp\|orig` | imágenes comprimidas (lo que recibe producción hoy) u originales del bucket |
| | `--rep N` | lecturas por imagen (1 no mide varianza; 3 sí) |
| | `--temperature X` | opcional; producción no la fija (default 1) |
| | `--solo texto` · `--limite N` | subconjunto, para pruebas de humo |
| | `--rehacer` | ignora lo ya leído. **Por defecto reanuda**: si la salida ya tiene una lectura buena de una imagen, no la vuelve a pedir |
| | `--max-llamadas N` | tope duro de llamadas (por defecto archivos × rep) |
| `comparar.mjs` | `--verdad ruta.json` | sin esto (o si no existe) corre en **modo proxy** contra la lectura vieja |
| | `--verdad-etiqueta "…"` | cómo nombrar la verdad en el informe (p. ej. «borrador no verificado») |
| | `--rep i` | qué repetición comparar (0) |

## Qué produce

En `HARNESS_DIR`: `set.json` (filas y archivos), `bajados.json` (tamaño y sha256 — detecta el
mismo archivo subido con dos nombres), `comprimidos.json` (qué se recodificó y a qué tamaño),
`lecturas_<prompt>.json` (por archivo: `extracted` crudo, `nro_normalizado`, `fecha_iso`, tokens,
latencia, errores; `meta` con el sha256 del prompt, tokens totales y costo estimado),
`informe_<prompt>.md` + `.json` (el detalle por archivo para otros scripts).

## Qué mide

Por banco y por campo — `nro_operacion` (el **normalizado**, lo que producción usaría), `monto`,
`fecha_dia` y `fecha_hora` (en hora de Bolivia), `glosa` (por contenido: el BCP antepone «BM QR»),
`banco_origen`, `cuenta_destino` (con máscara; `200****154` calza con `2000274154`), `titular_destino`,
`titular_origen`, `moneda` — aciertos, errores y **tipo de error**:

`glosa_como_nro` · `cuenta_adescruz_como_nro` · `campo_comprobante_bnb_como_nro` · `nro_cortado_o_incompleto` ·
`nro_un_caracter_distinto` · `nro_abono_en_vez_de_debito` · `nro_otro_codigo_del_comprobante:<cuál>` ·
`nro_descartado_por_guard` · `nro_no_leido` · `monto_no_leido` · `monto_cero` · `monto_distinto` ·
`fecha_dia_corrido` · `fecha_dia_mes_invertidos` · `hora_corrida_4h` · `hora_am_pm` · `glosa_fue_al_nro` ·
`glosa_no_leida` · `glosa_nota_del_cliente` · `glosa_es_un_nombre` · `banco_no_leido` ·
`banco_destino_como_origen` · `ci_como_cuenta` · `cuenta_origen_como_destino` · `cuenta_ajena_como_destino` ·
`cuenta_no_leida` · `origen_destino_invertidos` · `titular_*_distinto` · `inventado`… Los N° y montos se
imprimen; **el valor leído de una cuenta que no sea la de ADESCRUZ nunca** (solo la clasificación).

Y **simula la decisión**: corre `validarPago()` del módulo compartido (el validador de HOY) sobre
cada lectura, con `expected` = `monto_esperado` de la fila y la glosa esperada del concurso
(`campeonatos.glosa_esperada`; afiliaciones «Afiliacion ADESCRUZ <gestión>»), y cuenta cuántas filas
quedarían `aprobada` vs `revision_manual`, **cuántas aprobaciones serían incorrectas** contra la
verdad (monto, N° o cuenta distintos, o pago que no fue a nuestra cuenta), y por qué caen a
revisión. Lo mismo para la lectura vieja de la base re-validada con el validador de hoy, y la
decisión que quedó guardada en su momento.

### La tabla de verdad

`comparar.mjs` espera `{ meta, entradas: [ { archivo, filas, verdad: { banco_origen, formato,
tipo_transaccion, monto, moneda, fecha_hora_impresa "YYYY-MM-DD HH:MM[:SS]" (Bolivia), nro_operacion,
glosa, cuenta_destino (con máscara), titular_destino, titular_origen, banco_destino_impreso, legible,
confianza, dudas, extras } } ] }`. También acepta una lista, u objetos con los campos al tope. Usa
`extras.bancarizacion_abono`, `extras.ci_nit_destino`, `extras.nota_del_cliente` para clasificar errores.
⚠️ La verdad del 22-sep-2026 la leyó un agente mirando cada imagen: **no es verificación humana**;
lo que marca confianza media/baja sale listado al final del informe como duda, no como error.

`ejemplos/` tiene un set, unas lecturas y una verdad **ficticios** (4 casos: todo bien, glosa como
N°, origen/destino invertidos + CI como cuenta, monto mal leído que aprobaría) para probar el
comparador sin base ni API:

```bash
$N scripts/ocr-harness/comparar.mjs --set scripts/ocr-harness/ejemplos/set_ejemplo.json \
   --lecturas scripts/ocr-harness/ejemplos/lecturas_ejemplo.json \
   --verdad scripts/ocr-harness/ejemplos/verdad_ejemplo.json --out /tmp/informe_ejemplo.md
```

## Qué NO mide (leer antes de sacar conclusiones)

- **Una repetición no mide varianza.** Producción no fija `temperature` (default 1): la misma imagen
  puede leerse distinto dos veces. Con `--rep 3` se ve; con `--rep 1`, no.
- **PIL ≠ canvas.** `comprimir.py` aplica las mismas reglas que `comprimir.js` (2000 px de lado
  largo, JPEG 0,85, fondo blanco, ≤300 KB y ≤2000 px no se toca, PDF tal cual, EXIF respetado),
  pero el remuestreo (LANCZOS vs el del navegador) y el encoder JPEG son otros: mismo tamaño y
  calidad nominal, píxeles y bytes distintos. Para el OCR es equivalente en la práctica; no es
  idéntico.
- **La lectura vieja de la base** es la salida del prompt de entonces sobre la imagen **sin
  comprimir**, ya pasada por `parseFechaPago`; su fecha quedó corregida con las 95 del 21-sep (93 de
  98 coinciden con la columna `fecha_pago`), así que se compara por día y hora como la nueva.
- **No simula** el anti-reúso por N° (`operaciones_consumidas`) ni el chequeo de cierre; **no
  toca la base**. La ruta automática de producción para afiliaciones usa la glosa fija de
  `site_config` (2026) para todas las gestiones; el harness usa la de cada gestión, como el modo
  «leer» del admin.
- La verdad mide lo que dice el comprobante, no si el pago corresponde a esa fila (pagos múltiples,
  complementos en otra transferencia): eso está en `verdad.dudas`.

## Costo y tiempo por corrida (medido el 22-sep-2026)

Modelo `claude-sonnet-4-5`, `max_tokens 1024`, imágenes comprimidas: **~2.400 tokens de entrada y
~250 de salida por imagen**, ~7 s por llamada, 3 en paralelo. **112 imágenes × 1 rep ≈ 0,3 M tokens
de entrada ≈ US$ 1,2** (a US$ 3 / 15 por millón de tokens — precio a verificar en la página de
precios; `leer.mjs` lo estima en `meta.costo_usd_estimado`). Con `--rep 3` y dos prompts, ≈ US$ 7.
El módulo compartido no exporta el modelo ni `max_tokens`: `leer.mjs` los replica y avisa si en
`validacion-pagos.ts` cambiaron.

## Qué del módulo compartido corre en Node

Todo `validacion-pagos.ts` importa sin shims (`PROMPT_OCR`, `parseFechaPago`, `normalizarNroOperacion`,
`clasificarCuentaDestino`, `validarPago`, `detectMediaType`). `callClaudeVision` no se usa porque tiene
el prompt fijo: `leerConPrompt()` en `leer.mjs` replica su `fetch` (modelo, `max_tokens`, bloque
`image`/`document`, limpieza de ``` y `JSON.parse`) con el prompt como parámetro.
