---
titulo: El «Código» del Mercantil también tiene 17 dígitos (2-oct-2026)
tags: [adescruz, comprobantes, ocr, mercantil]
actualizada: 2026-10-06
estado: activa
enlaces_sugeridos: [comprobantes-bancos-bolivia, cobro-de-inscripciones]
---

# El «Código» del Mercantil también tiene 17 dígitos

El 2026-10-02 entraron dos inscripciones de Antonella Bejarano pagadas por el Banco Mercantil Santa Cruz.
Daniel revisó los comprobantes y estaban bien, pero el validador las mandó a revisión manual con este motivo:

> N° de operación con forma inválida para Mercantil: "10032026100235378" (se esperaba 18 o 19 dígitos que empiezan con 1003)

El otro decía lo mismo con `10032026100234327`.

## Causa

El «Código» del Mercantil es `1003` + la fecha AAAAMMDD + un contador sin ceros a la izquierda. El contador
**no tiene largo fijo**. Los dos códigos son `1003 | 20261002 | 35378` y `1003 | 20261002 | 34327`: el
contador tiene 5 dígitos y el código, 17.

La regla de forma del validador (`FORMAS_NRO` en `supabase/functions/_shared/validacion-pagos.ts`) era
`/^1003\d{14,15}$/`, es decir, 18 o 19 dígitos. Se había medido sobre los comprobantes del XIII y el XIV, donde
ningún contador era tan corto. La nota de recursos del cerebro sobre comprobantes ya advertía que el largo
varía con la hora («un código de 18 dígitos es un pago de la mañana»), pero el código seguía exigiendo 18-19.

**No fue una mala lectura del OCR.** La doble lectura coincidió en los dos casos. Si no hubiera coincidido, el
motivo habría sido «las dos lecturas no coinciden». La hora de los dos pagos no se verificó.

## Qué se hizo (HECHO)

- **Regla nueva** (commit `c952207` en `main` de adescruz-ranking): `1003` + una fecha posible (año `20xx`,
  mes 01-12, día 01-31) + un contador de 1 a 8 dígitos. El texto del motivo pasó a decir
  «1003 + fecha AAAAMMDD + contador».
- **Guía del lector (`PROMPT_OCR`)**: antes decía «18-19 DIGITS … if you read fewer than 18, re-read». Eso
  empujaba al modelo a agregar un dígito para llegar a 18. Ahora dice que el largo varía (17-19 en general),
  que copie cada dígito tal cual y que nunca agregue ni saque dígitos para llegar a un largo.
- **Probada** con node contra los dos códigos reales, dos de 19 dígitos ya conocidos, uno de 18, y casos
  inválidos (mes 13, día 32, prefijo distinto, cortado, con letra, un N° de otro banco). Todos dieron lo
  esperado. El archivo compila con `tsc`.
- **Desplegada el 2026-10-02 por Daniel desde el editor web de Supabase** (Edge Functions → Code), en
  **las dos** funciones que empaquetan el módulo: `validar-comprobante` y `validar-comprobante-afiliacion`.
  Pegó el archivo completo de `main`. ⚠️ El mensaje del commit dice «SIN desplegar», pero **sí está desplegado**.
- **Las dos inscripciones de Antonella las aprobó Daniel a mano** el mismo día, después de comparar el código
  y el monto contra cada imagen. Son dos pagos distintos, no uno reusado.

## Qué quedó abierto

- 🔴 **El cambio de la guía del lector no se midió en el harness.** El propio código dice que cualquier cambio
  del prompt se mide primero en `scripts/ocr-harness/` sobre la tabla de verdad. Esta vez no se hizo, y
  `scripts/ocr-harness/prompts/v23-banco.txt` ya **no coincide** con el prompt desplegado. Falta medirlo o
  guardarlo como un v24.
- **La regla de forma sigue sin ver errores de un carácter.** Un dígito de más o de menos en el contador
  ahora pasa la forma. Contra eso sigue estando la doble lectura, igual que antes.
- **Dato viejo en el cerebro:** la nota de recursos sobre comprobantes de bancos bolivianos dice «18 o 19
  dígitos» en su tabla y cita la regla `1003\d{14,15}` como la vigente. Hay que corregir las dos cosas.

Relacionado: [[adescruz]]
