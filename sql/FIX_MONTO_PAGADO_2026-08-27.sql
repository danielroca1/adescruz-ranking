-- ============================================================================
-- FIX_MONTO_PAGADO_2026-08-27.sql
--
-- Rellena la columna PAGADO que el bug de `CLAUDE_API` dejó vacía.
--
-- Las 8 inscripciones que cayeron en la ventana del OCR roto (20 al 27-ago)
-- muestran "—" en el admin, que se lee como "no pagó". Es falso: pagaron
-- bien. Daniel verificó cada comprobante a mano al aprobarlas, y eso quedó
-- escrito en `nota_admin` ("Pago verificado" / "El monto es correcto").
--
-- ⚠️ NO ES UN DATO INVENTADO, PERO TAMPOCO ES UNA LECTURA DEL OCR.
-- El número que se escribe acá lo estableció una persona mirando el
-- comprobante, no el modelo leyendo la imagen. Se puede distinguir después
-- SIN columna nueva: si `validacion_ocr` tiene `error`, el OCR nunca corrió,
-- así que cualquier `monto_pagado` de esa fila lo puso un humano. El admin
-- usa exactamente esa derivación para marcarlo con ✋ en pantalla.
--
-- CASO APARTE — Fharid Galvis: su comprobante dice Bs 200 de verdad (el OCR
-- funcionaba y leyó bien). Los Bs 50 que faltaban los mandó después en una
-- segunda transferencia. Por decisión de Daniel (27-ago) la columna pasa a
-- decir la verdad del dinero recibido —250— y la nota conserva que el primer
-- comprobante era de 200. Queda pendiente adjuntar el comprobante de los 50.
--
-- Verificado: el único trigger de UPDATE de `inscripciones` está scopeado a la
-- columna `estado`, que este script no toca. Cero correos.
-- Idempotente: la segunda corrida no encuentra filas.
-- ============================================================================

-- ─── PASO 1: preview ───────────────────────────────────────────────────────
select 'ANTES' as momento, nombre, monto_esperado, monto_pagado,
       (validacion_ocr ? 'error') as ocr_fallo, left(coalesce(nota_admin,''),40) as nota
  from inscripciones
 where (estado = 'aprobada' and monto_pagado is null)
    or nombre = 'Fharid Galvis'
 order by created_at;

-- ─── PASO 2: las 8 del OCR caído ───────────────────────────────────────────
-- Solo filas APROBADAS (Daniel ya las verificó una por una) y SOLO las que
-- fallaron por el bug: si el OCR corrió y no leyó el monto, eso es otra cosa
-- y no se rellena a ciegas.
update inscripciones
   set monto_pagado = monto_esperado,
       nota_admin   = coalesce(nota_admin || ' | ', '') ||
                      'Monto cargado el 27-ago desde monto_esperado: el OCR estaba caido (bug CLAUDE_API) y Daniel habia verificado el comprobante a mano al aprobar.'
 where estado = 'aprobada'
   and monto_pagado is null
   and monto_esperado is not null
   and validacion_ocr ? 'error';

-- ─── PASO 3: Fharid Galvis — pagó en dos veces ─────────────────────────────
update inscripciones
   set monto_pagado = 250,
       nota_admin   = coalesce(nota_admin || ' | ', '') ||
                      'Monto corregido a Bs 250 el 27-ago: el comprobante subido es de Bs 200 y los Bs 50 restantes llegaron en una segunda transferencia. PENDIENTE adjuntar el comprobante de los 50.'
 where nombre = 'Fharid Galvis'
   and monto_pagado = 200
   and monto_esperado = 250;

-- ─── PASO 4: verificación ──────────────────────────────────────────────────
select 'DESPUES' as momento,
       (select count(*) from inscripciones where estado='aprobada' and monto_pagado is null) as aprobadas_sin_monto,
       (select count(*) from inscripciones where monto_pagado is not null and validacion_ocr ? 'error') as cargadas_a_mano,
       (select count(*) from inscripciones where estado='aprobada' and monto_pagado < monto_esperado) as siguen_cortas;

select 'DETALLE' as que, nombre, monto_esperado, monto_pagado,
       (validacion_ocr ? 'error') as cargado_a_mano
  from inscripciones where estado = 'aprobada' order by created_at;
